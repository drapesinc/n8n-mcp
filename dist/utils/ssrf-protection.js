"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSRFProtection = void 0;
const url_1 = require("url");
const promises_1 = require("dns/promises");
const net_1 = require("net");
const logger_1 = require("./logger");
const CLOUD_METADATA = new Set([
    '169.254.169.254',
    '169.254.170.2',
    'metadata.google.internal',
    'metadata',
    '100.100.100.200',
    '192.0.0.192',
]);
const LOCALHOST_PATTERNS = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0',
    'localhost.localdomain',
]);
const PRIVATE_IP_RANGES = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^169\.254\./,
    /^127\./,
    /^0\./,
];
class SSRFProtection {
    static isPrivateOrMappedIpv6(hostname) {
        if (!(0, net_1.isIPv6)(hostname))
            return false;
        if (hostname.startsWith('::'))
            return true;
        if (hostname.startsWith('0:0:0:0:0:ffff:'))
            return true;
        if (hostname.startsWith('fe80:'))
            return true;
        if (/^fe[c-f]/.test(hostname))
            return true;
        if (/^f[cd]/.test(hostname))
            return true;
        if (hostname.startsWith('2002:'))
            return true;
        if (hostname.startsWith('64:ff9b:'))
            return true;
        return false;
    }
    static async validateWebhookUrl(urlString) {
        try {
            const url = new url_1.URL(urlString);
            const mode = (process.env.WEBHOOK_SECURITY_MODE || 'strict');
            if (!['http:', 'https:'].includes(url.protocol)) {
                return { valid: false, reason: 'Invalid protocol. Only HTTP/HTTPS allowed.' };
            }
            let hostname = url.hostname.toLowerCase();
            if (hostname.startsWith('[') && hostname.endsWith(']')) {
                hostname = hostname.slice(1, -1);
            }
            if (CLOUD_METADATA.has(hostname)) {
                logger_1.logger.warn('SSRF blocked: Cloud metadata endpoint', { hostname, mode });
                return { valid: false, reason: 'Cloud metadata endpoint blocked' };
            }
            let resolvedIP;
            try {
                const { address } = await (0, promises_1.lookup)(hostname);
                resolvedIP = address;
                logger_1.logger.debug('DNS resolved for SSRF check', { hostname, resolvedIP, mode });
            }
            catch (error) {
                logger_1.logger.warn('DNS resolution failed for webhook URL', {
                    hostname,
                    error: error instanceof Error ? error.message : String(error)
                });
                return { valid: false, reason: 'DNS resolution failed' };
            }
            if (CLOUD_METADATA.has(resolvedIP)) {
                logger_1.logger.warn('SSRF blocked: Hostname resolves to cloud metadata IP', {
                    hostname,
                    resolvedIP,
                    mode
                });
                return { valid: false, reason: 'Hostname resolves to cloud metadata endpoint' };
            }
            if (mode === 'permissive') {
                logger_1.logger.warn('SSRF protection in permissive mode (localhost and private IPs allowed)', {
                    hostname,
                    resolvedIP
                });
                return { valid: true };
            }
            const isLocalhost = LOCALHOST_PATTERNS.has(hostname) ||
                resolvedIP === '::1' ||
                resolvedIP.startsWith('127.');
            if (mode === 'strict' && isLocalhost) {
                logger_1.logger.warn('SSRF blocked: Localhost not allowed in strict mode', {
                    hostname,
                    resolvedIP
                });
                return { valid: false, reason: 'Localhost access is blocked in strict mode' };
            }
            if (mode === 'moderate' && isLocalhost) {
                logger_1.logger.info('Localhost webhook allowed (moderate mode)', { hostname, resolvedIP });
                return { valid: true };
            }
            if (PRIVATE_IP_RANGES.some(regex => regex.test(resolvedIP))) {
                logger_1.logger.warn('SSRF blocked: Private IP address', { hostname, resolvedIP, mode });
                return {
                    valid: false,
                    reason: mode === 'strict'
                        ? 'Private IP addresses not allowed'
                        : 'Private IP addresses not allowed (use WEBHOOK_SECURITY_MODE=permissive if needed)'
                };
            }
            if (SSRFProtection.isPrivateOrMappedIpv6(resolvedIP)) {
                logger_1.logger.warn('SSRF blocked: IPv6 private address', {
                    hostname,
                    resolvedIP,
                    mode
                });
                return { valid: false, reason: 'IPv6 private address not allowed' };
            }
            return { valid: true };
        }
        catch (error) {
            return { valid: false, reason: 'Invalid URL format' };
        }
    }
    static validateUrlSync(urlString) {
        if (typeof urlString !== 'string' || urlString.includes('#')) {
            return { valid: false, reason: 'URL fragments are not allowed' };
        }
        let url;
        try {
            url = new url_1.URL(urlString);
        }
        catch {
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
        const mode = (process.env.WEBHOOK_SECURITY_MODE || 'strict');
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
        if (SSRFProtection.isPrivateOrMappedIpv6(hostname)) {
            return { valid: false, reason: 'IPv6 private/mapped address not allowed' };
        }
        return { valid: true };
    }
}
exports.SSRFProtection = SSRFProtection;
//# sourceMappingURL=ssrf-protection.js.map