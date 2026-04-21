import { URL } from 'url';
import { lookup } from 'dns/promises';
import { isIPv6 } from 'net';
import { logger } from './logger';

/**
 * SSRF Protection Utility with Configurable Security Modes
 *
 * Validates URLs to prevent Server-Side Request Forgery attacks including DNS rebinding
 * See: https://github.com/czlonkowski/n8n-mcp/issues/265 (HIGH-03)
 *
 * Security Modes:
 * - strict (default): Block localhost + private IPs + cloud metadata (production)
 * - moderate: Allow localhost, block private IPs + cloud metadata (local dev)
 * - permissive: Allow localhost + private IPs, block cloud metadata (testing only)
 */

// Security mode type
type SecurityMode = 'strict' | 'moderate' | 'permissive';

// Cloud metadata endpoints (ALWAYS blocked in all modes)
const CLOUD_METADATA = new Set([
  // AWS/Azure
  '169.254.169.254', // AWS/Azure metadata
  '169.254.170.2',   // AWS ECS metadata
  // Google Cloud
  'metadata.google.internal', // GCP metadata
  'metadata',
  // Alibaba Cloud
  '100.100.100.200', // Alibaba Cloud metadata
  // Oracle Cloud
  '192.0.0.192',     // Oracle Cloud metadata
]);

// Localhost patterns
const LOCALHOST_PATTERNS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  'localhost.localdomain',
]);

// Private IP ranges (regex for IPv4)
const PRIVATE_IP_RANGES = [
  /^10\./,                          // 10.0.0.0/8
  /^192\.168\./,                    // 192.168.0.0/16
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
  /^169\.254\./,                    // 169.254.0.0/16 (Link-local)
  /^127\./,                         // 127.0.0.0/8 (Loopback)
  /^0\./,                           // 0.0.0.0/8 (Invalid)
];

export class SSRFProtection {
  /**
   * IPv6 addresses that must be blocked: loopback, unspecified, link-local,
   * unique-local, site-local (deprecated), IPv4-mapped, IPv4-compatible,
   * 6to4, and NAT64-mapped addresses. All of these either represent private
   * networks or embed an arbitrary IPv4 address that would bypass IPv4-only
   * SSRF checks.
   *
   * Hostname must be lowercased and bracket-stripped. WHATWG URL parser
   * canonicalizes IPv6 literals (zero compression, dotted-quad → hex pairs),
   * so prefix matching works against the normalized form.
   *
   * @security See GHSA-56c3-vfp2-5qqj. The sync validator previously had no
   * IPv6 gate, letting `::ffff:169.254.169.254`, `::169.254.169.254`,
   * `2002:a9fe:a9fe::`, and `64:ff9b::a9fe:a9fe` reach the HTTP client.
   */
  private static isPrivateOrMappedIpv6(hostname: string): boolean {
    // Gate on net.isIPv6 so domain names starting with hex-like labels
    // (e.g. "fcexample.com") are never misclassified as private IPv6.
    if (!isIPv6(hostname)) return false;

    // ::/96 reserved block: unspecified (`::`), loopback (`::1`), IPv4-mapped
    // (`::ffff:X`), and deprecated IPv4-compatible (`::X:Y` per RFC 4291) all
    // live here. Blocking the whole prefix avoids enumerating subforms.
    if (hostname.startsWith('::')) return true;

    // Defensive long-form IPv4-mapped — WHATWG URL normally compresses this,
    // but keep the check in case normalization ever changes.
    if (hostname.startsWith('0:0:0:0:0:ffff:')) return true;

    // Link-local fe80::/10
    if (hostname.startsWith('fe80:')) return true;

    // Site-local fec0::/10 (deprecated, RFC 3879) — still honored by some stacks.
    if (/^fe[c-f]/.test(hostname)) return true;

    // Unique local fc00::/7 (RFC 4193). Covers fc00-fdff in the first hextet.
    if (/^f[cd]/.test(hostname)) return true;

    // 6to4 2002::/16 (RFC 3056) — bits 16-47 embed an arbitrary IPv4 address,
    // so any 2002: address can tunnel to RFC1918 or metadata endpoints.
    if (hostname.startsWith('2002:')) return true;

    // NAT64 64:ff9b::/96 (RFC 6052) and 64:ff9b:1::/48 (RFC 8215) — embedded
    // IPv4 in the low 32 bits, same tunneling concern as 6to4.
    if (hostname.startsWith('64:ff9b:')) return true;

    return false;
  }

  /**
   * Validate webhook URL for SSRF protection with configurable security modes
   *
   * @param urlString - URL to validate
   * @returns Promise with validation result
   *
   * @security Uses DNS resolution to prevent DNS rebinding attacks
   *
   * @example
   * // Production (default strict mode)
   * const result = await SSRFProtection.validateWebhookUrl('http://localhost:5678');
   * // { valid: false, reason: 'Localhost not allowed' }
   *
   * @example
   * // Local development (moderate mode)
   * process.env.WEBHOOK_SECURITY_MODE = 'moderate';
   * const result = await SSRFProtection.validateWebhookUrl('http://localhost:5678');
   * // { valid: true }
   */
  static async validateWebhookUrl(urlString: string): Promise<{
    valid: boolean;
    reason?: string
  }> {
    try {
      const url = new URL(urlString);
      const mode: SecurityMode = (process.env.WEBHOOK_SECURITY_MODE || 'strict') as SecurityMode;

      // Step 1: Must be HTTP/HTTPS (all modes)
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { valid: false, reason: 'Invalid protocol. Only HTTP/HTTPS allowed.' };
      }

      // Get hostname and strip IPv6 brackets if present
      let hostname = url.hostname.toLowerCase();
      // Remove IPv6 brackets for consistent comparison
      if (hostname.startsWith('[') && hostname.endsWith(']')) {
        hostname = hostname.slice(1, -1);
      }

      // Step 2: ALWAYS block cloud metadata endpoints (all modes)
      if (CLOUD_METADATA.has(hostname)) {
        logger.warn('SSRF blocked: Cloud metadata endpoint', { hostname, mode });
        return { valid: false, reason: 'Cloud metadata endpoint blocked' };
      }

      // Step 3: Resolve DNS to get actual IP address
      // This prevents DNS rebinding attacks where hostname resolves to different IPs
      let resolvedIP: string;
      try {
        const { address } = await lookup(hostname);
        resolvedIP = address;

        logger.debug('DNS resolved for SSRF check', { hostname, resolvedIP, mode });
      } catch (error) {
        logger.warn('DNS resolution failed for webhook URL', {
          hostname,
          error: error instanceof Error ? error.message : String(error)
        });
        return { valid: false, reason: 'DNS resolution failed' };
      }

      // Step 4: ALWAYS block cloud metadata IPs (all modes)
      if (CLOUD_METADATA.has(resolvedIP)) {
        logger.warn('SSRF blocked: Hostname resolves to cloud metadata IP', {
          hostname,
          resolvedIP,
          mode
        });
        return { valid: false, reason: 'Hostname resolves to cloud metadata endpoint' };
      }

      // Step 5: Mode-specific validation

      // MODE: permissive - Allow everything except cloud metadata
      if (mode === 'permissive') {
        logger.warn('SSRF protection in permissive mode (localhost and private IPs allowed)', {
          hostname,
          resolvedIP
        });
        return { valid: true };
      }

      // Check if target is localhost
      const isLocalhost = LOCALHOST_PATTERNS.has(hostname) ||
                        resolvedIP === '::1' ||
                        resolvedIP.startsWith('127.');

      // MODE: strict - Block localhost and private IPs
      if (mode === 'strict' && isLocalhost) {
        logger.warn('SSRF blocked: Localhost not allowed in strict mode', {
          hostname,
          resolvedIP
        });
        return { valid: false, reason: 'Localhost access is blocked in strict mode' };
      }

      // MODE: moderate - Allow localhost, block private IPs
      if (mode === 'moderate' && isLocalhost) {
        logger.info('Localhost webhook allowed (moderate mode)', { hostname, resolvedIP });
        return { valid: true };
      }

      // Step 6: Check private IPv4 ranges (strict & moderate modes)
      if (PRIVATE_IP_RANGES.some(regex => regex.test(resolvedIP))) {
        logger.warn('SSRF blocked: Private IP address', { hostname, resolvedIP, mode });
        return {
          valid: false,
          reason: mode === 'strict'
            ? 'Private IP addresses not allowed'
            : 'Private IP addresses not allowed (use WEBHOOK_SECURITY_MODE=permissive if needed)'
        };
      }

      // Step 7: IPv6 private address check (strict & moderate modes)
      if (SSRFProtection.isPrivateOrMappedIpv6(resolvedIP)) {
        logger.warn('SSRF blocked: IPv6 private address', {
          hostname,
          resolvedIP,
          mode
        });
        return { valid: false, reason: 'IPv6 private address not allowed' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: 'Invalid URL format' };
    }
  }

  /**
   * Synchronous URL validation with no DNS resolution.
   *
   * Suitable for sync callers that cannot await DNS lookups. Pair with
   * {@link validateWebhookUrl} at async boundaries for full protection.
   *
   * @param urlString - URL to validate (raw input, not parsed)
   * @returns Validation result with optional reason on failure
   *
   * @security See GHSA-4ggg-h7ph-26qr.
   */
  static validateUrlSync(urlString: string): { valid: boolean; reason?: string } {
    if (typeof urlString !== 'string' || urlString.includes('#')) {
      return { valid: false, reason: 'URL fragments are not allowed' };
    }

    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      return { valid: false, reason: 'Invalid URL format' };
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, reason: 'Invalid protocol. Only HTTP/HTTPS allowed.' };
    }

    if (url.username !== '' || url.password !== '') {
      return { valid: false, reason: 'Userinfo in URL is not allowed' };
    }

    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }

    if (CLOUD_METADATA.has(hostname)) {
      return { valid: false, reason: 'Cloud metadata endpoint blocked' };
    }

    const mode: SecurityMode = (process.env.WEBHOOK_SECURITY_MODE || 'strict') as SecurityMode;

    if (mode === 'permissive') {
      return { valid: true };
    }

    if (mode === 'strict' && LOCALHOST_PATTERNS.has(hostname)) {
      return { valid: false, reason: 'Localhost access is blocked in strict mode' };
    }

    if (PRIVATE_IP_RANGES.some(regex => regex.test(hostname))) {
      return {
        valid: false,
        reason: mode === 'strict'
          ? 'Private IP addresses not allowed'
          : 'Private IP addresses not allowed (use WEBHOOK_SECURITY_MODE=permissive if needed)'
      };
    }

    // SECURITY (GHSA-56c3-vfp2-5qqj): reject IPv4-mapped and private IPv6
    // addresses. Without this, hostnames like `::ffff:169.254.169.254` or
    // `::ffff:127.0.0.1` pass the IPv4-only checks above and reach the HTTP
    // client.
    if (SSRFProtection.isPrivateOrMappedIpv6(hostname)) {
      return { valid: false, reason: 'IPv6 private/mapped address not allowed' };
    }

    return { valid: true };
  }
}
