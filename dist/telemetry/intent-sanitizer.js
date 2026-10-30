"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intentSanitizer = exports.IntentSanitizer = void 0;
const email_redaction_1 = require("./email-redaction");
const PII_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
    url: /https?:\/\/[^\s]+/gi,
    ip: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    phone: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    apiKey: /\b[A-Za-z0-9_-]{32,}\b/g,
    uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    filePath: /(?:\/[\w.-]+)+\/?|(?:[A-Z]:\\(?:[\w.-]+\\)*[\w.-]+)/g,
    secret: /\b(?:password|passwd|pwd|secret|token|key)[:=\s]+[^\s]+/gi,
};
const COMPANY_PATTERNS = {
    companySuffix: /\b\w+(?:\s+(?:Inc|LLC|Corp|Corporation|Ltd|Limited|GmbH|AG)\.?)\b/gi,
    businessContext: /\b(?:company|organization|client|customer)\s+(?:named?|called)\s+\w+/gi,
};
const MAX_INTENT_LENGTH = 10000;
const EMAIL_DOMAIN = /[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/iy;
class IntentSanitizer {
    sanitize(intent) {
        if (!intent) {
            return intent;
        }
        if (intent.length > MAX_INTENT_LENGTH) {
            return '[TRUNCATED]';
        }
        let sanitized = intent;
        sanitized = (0, email_redaction_1.redactEmailAddresses)(sanitized, EMAIL_DOMAIN, '[EMAIL]');
        sanitized = sanitized.replace(PII_PATTERNS.url, '[URL]');
        sanitized = sanitized.replace(PII_PATTERNS.ip, '[IP_ADDRESS]');
        sanitized = sanitized.replace(PII_PATTERNS.phone, '[PHONE]');
        sanitized = sanitized.replace(PII_PATTERNS.creditCard, '[CARD_NUMBER]');
        sanitized = sanitized.replace(PII_PATTERNS.apiKey, '[API_KEY]');
        sanitized = sanitized.replace(PII_PATTERNS.uuid, '[UUID]');
        sanitized = sanitized.replace(PII_PATTERNS.filePath, '[FILE_PATH]');
        sanitized = sanitized.replace(PII_PATTERNS.secret, '[SECRET]');
        sanitized = sanitized.replace(COMPANY_PATTERNS.companySuffix, '[COMPANY]');
        sanitized = sanitized.replace(COMPANY_PATTERNS.businessContext, '[COMPANY_CONTEXT]');
        sanitized = sanitized.replace(/\s{2,}/g, ' ').trim();
        return sanitized;
    }
    containsPII(intent) {
        if (!intent) {
            return false;
        }
        return Object.values(PII_PATTERNS).some((pattern) => pattern.test(intent));
    }
    detectPIITypes(intent) {
        if (!intent) {
            return [];
        }
        const detected = [];
        if (PII_PATTERNS.email.test(intent))
            detected.push('email');
        if (PII_PATTERNS.url.test(intent))
            detected.push('url');
        if (PII_PATTERNS.ip.test(intent))
            detected.push('ip_address');
        if (PII_PATTERNS.phone.test(intent))
            detected.push('phone');
        if (PII_PATTERNS.creditCard.test(intent))
            detected.push('credit_card');
        if (PII_PATTERNS.apiKey.test(intent))
            detected.push('api_key');
        if (PII_PATTERNS.uuid.test(intent))
            detected.push('uuid');
        if (PII_PATTERNS.filePath.test(intent))
            detected.push('file_path');
        if (PII_PATTERNS.secret.test(intent))
            detected.push('secret');
        Object.values(PII_PATTERNS).forEach((pattern) => {
            pattern.lastIndex = 0;
        });
        return detected;
    }
    truncate(intent, maxLength = 1000) {
        if (!intent || intent.length <= maxLength) {
            return intent;
        }
        const truncated = intent.substring(0, maxLength);
        const lastSentence = truncated.lastIndexOf('.');
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSentence > maxLength * 0.8) {
            return truncated.substring(0, lastSentence + 1);
        }
        else if (lastSpace > maxLength * 0.9) {
            return truncated.substring(0, lastSpace) + '...';
        }
        return truncated + '...';
    }
    isSafeForTelemetry(intent) {
        if (!intent) {
            return true;
        }
        if (intent.length > 5000) {
            return false;
        }
        if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(intent)) {
            return false;
        }
        return true;
    }
}
exports.IntentSanitizer = IntentSanitizer;
exports.intentSanitizer = new IntentSanitizer();
//# sourceMappingURL=intent-sanitizer.js.map