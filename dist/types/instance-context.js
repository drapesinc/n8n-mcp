"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isInstanceContext = isInstanceContext;
exports.validateInstanceContext = validateInstanceContext;
const ssrf_protection_1 = require("../utils/ssrf-protection");
function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
        }
        if (!parsed.hostname || parsed.hostname.length === 0) {
            return false;
        }
        if (parsed.port && (isNaN(Number(parsed.port)) || Number(parsed.port) < 1 || Number(parsed.port) > 65535)) {
            return false;
        }
        const hostname = parsed.hostname.toLowerCase();
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
            return true;
        }
        const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipv4Pattern.test(hostname)) {
            const parts = hostname.split('.');
            return parts.every(part => {
                const num = parseInt(part, 10);
                return num >= 0 && num <= 255;
            });
        }
        if (hostname.includes(':') || hostname.startsWith('[') && hostname.endsWith(']')) {
            return true;
        }
        const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
        return domainPattern.test(hostname);
    }
    catch {
        return false;
    }
}
function isValidApiKey(key) {
    return key.length > 0 &&
        !key.toLowerCase().includes('your_api_key') &&
        !key.toLowerCase().includes('placeholder') &&
        !key.toLowerCase().includes('example');
}
function isInstanceContext(obj) {
    if (!obj || typeof obj !== 'object')
        return false;
    const hasValidUrl = obj.n8nApiUrl === undefined ||
        (typeof obj.n8nApiUrl === 'string' && isValidUrl(obj.n8nApiUrl));
    const hasValidKey = obj.n8nApiKey === undefined ||
        (typeof obj.n8nApiKey === 'string' && isValidApiKey(obj.n8nApiKey));
    const hasValidTimeout = obj.n8nApiTimeout === undefined ||
        (typeof obj.n8nApiTimeout === 'number' && obj.n8nApiTimeout > 0);
    const hasValidRetries = obj.n8nApiMaxRetries === undefined ||
        (typeof obj.n8nApiMaxRetries === 'number' && obj.n8nApiMaxRetries >= 0);
    const hasValidInstanceId = obj.instanceId === undefined || typeof obj.instanceId === 'string';
    const hasValidSessionId = obj.sessionId === undefined || typeof obj.sessionId === 'string';
    const hasValidMetadata = obj.metadata === undefined ||
        (typeof obj.metadata === 'object' && obj.metadata !== null);
    return hasValidUrl && hasValidKey && hasValidTimeout && hasValidRetries &&
        hasValidInstanceId && hasValidSessionId && hasValidMetadata;
}
function validateInstanceContext(context) {
    const errors = [];
    if (context.n8nApiUrl !== undefined) {
        if (context.n8nApiUrl === '') {
            errors.push(`Invalid n8nApiUrl: empty string - URL is required when field is provided`);
        }
        else if (!isValidUrl(context.n8nApiUrl)) {
            try {
                const parsed = new URL(context.n8nApiUrl);
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                    errors.push(`Invalid n8nApiUrl: URL must use HTTP or HTTPS protocol, got ${parsed.protocol}`);
                }
            }
            catch {
                errors.push(`Invalid n8nApiUrl: URL format is malformed or incomplete`);
            }
        }
        else {
            const ssrf = ssrf_protection_1.SSRFProtection.validateUrlSync(context.n8nApiUrl);
            if (!ssrf.valid) {
                errors.push(`Invalid n8nApiUrl: ${ssrf.reason}`);
            }
        }
    }
    if (context.n8nApiKey !== undefined) {
        if (context.n8nApiKey === '') {
            errors.push(`Invalid n8nApiKey: empty string - API key is required when field is provided`);
        }
        else if (!isValidApiKey(context.n8nApiKey)) {
            if (context.n8nApiKey.toLowerCase().includes('your_api_key')) {
                errors.push(`Invalid n8nApiKey: contains placeholder 'your_api_key' - Please provide actual API key`);
            }
            else if (context.n8nApiKey.toLowerCase().includes('placeholder')) {
                errors.push(`Invalid n8nApiKey: contains placeholder text - Please provide actual API key`);
            }
            else if (context.n8nApiKey.toLowerCase().includes('example')) {
                errors.push(`Invalid n8nApiKey: contains example text - Please provide actual API key`);
            }
            else {
                errors.push(`Invalid n8nApiKey: format validation failed - Ensure key is valid`);
            }
        }
    }
    if (context.n8nApiTimeout !== undefined) {
        if (typeof context.n8nApiTimeout !== 'number') {
            errors.push(`Invalid n8nApiTimeout: ${context.n8nApiTimeout} - Must be a number, got ${typeof context.n8nApiTimeout}`);
        }
        else if (context.n8nApiTimeout <= 0) {
            errors.push(`Invalid n8nApiTimeout: ${context.n8nApiTimeout} - Must be positive (greater than 0)`);
        }
        else if (!isFinite(context.n8nApiTimeout)) {
            errors.push(`Invalid n8nApiTimeout: ${context.n8nApiTimeout} - Must be a finite number (not Infinity or NaN)`);
        }
    }
    if (context.n8nApiMaxRetries !== undefined) {
        if (typeof context.n8nApiMaxRetries !== 'number') {
            errors.push(`Invalid n8nApiMaxRetries: ${context.n8nApiMaxRetries} - Must be a number, got ${typeof context.n8nApiMaxRetries}`);
        }
        else if (context.n8nApiMaxRetries < 0) {
            errors.push(`Invalid n8nApiMaxRetries: ${context.n8nApiMaxRetries} - Must be non-negative (0 or greater)`);
        }
        else if (!isFinite(context.n8nApiMaxRetries)) {
            errors.push(`Invalid n8nApiMaxRetries: ${context.n8nApiMaxRetries} - Must be a finite number (not Infinity or NaN)`);
        }
    }
    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    };
}
//# sourceMappingURL=instance-context.js.map