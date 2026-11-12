"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeErrorMessageCore = sanitizeErrorMessageCore;
const logger_1 = require("../utils/logger");
function sanitizeErrorMessageCore(errorMessage) {
    try {
        const maxLength = 1500;
        const trimmed = errorMessage.length > maxLength
            ? errorMessage.substring(0, maxLength)
            : errorMessage;
        const lines = trimmed.split('\n');
        let sanitized = lines.slice(0, 3).join('\n');
        sanitized = sanitized.replace(/https?:\/\/\S+/gi, '[URL]');
        sanitized = sanitized
            .replace(/AKIA[A-Z0-9]{16}/g, '[AWS_KEY]')
            .replace(/ghp_[a-zA-Z0-9]{36,}/g, '[GITHUB_TOKEN]')
            .replace(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[JWT]')
            .replace(/Bearer\s+[^\s]+/gi, 'Bearer [TOKEN]');
        sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
        sanitized = sanitized
            .replace(/\b[a-zA-Z0-9_-]{32,}(?:\b|(?<=-))/g, '[KEY]')
            .replace(/(['"])[a-zA-Z0-9_-]{16,}\1/g, '$1[TOKEN]$1');
        sanitized = sanitized
            .replace(/password\s*[=:]\s*\S+/gi, 'password=[REDACTED]')
            .replace(/api[_-]?key\s*[=:]\s*\S+/gi, 'api_key=[REDACTED]')
            .replace(/\btoken\s*[=:]\s*[^\s;,)]+/gi, 'token=[REDACTED]');
        if (sanitized.length > 500) {
            sanitized = sanitized.substring(0, 500) + '...';
        }
        return sanitized;
    }
    catch (error) {
        logger_1.logger.debug('Error message sanitization failed:', error);
        return '[SANITIZATION_FAILED]';
    }
}
//# sourceMappingURL=error-sanitization-utils.js.map