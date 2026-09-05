"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.N8nServerError = exports.N8nRateLimitError = exports.N8nValidationError = exports.N8nNotFoundError = exports.N8nAuthenticationError = exports.N8nApiError = void 0;
exports.handleN8nApiError = handleN8nApiError;
exports.formatExecutionError = formatExecutionError;
exports.formatNoExecutionError = formatNoExecutionError;
exports.unknownSettingsKeysNamedBy = unknownSettingsKeysNamedBy;
exports.isUnknownSettingsPropertyError = isUnknownSettingsPropertyError;
exports.enrichUnknownPropertyError = enrichUnknownPropertyError;
exports.getUserFriendlyErrorMessage = getUserFriendlyErrorMessage;
exports.logN8nError = logN8nError;
const logger_1 = require("./logger");
const workflow_settings_1 = require("../constants/workflow-settings");
class N8nApiError extends Error {
    constructor(message, statusCode, code, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = 'N8nApiError';
    }
}
exports.N8nApiError = N8nApiError;
class N8nAuthenticationError extends N8nApiError {
    constructor(message = 'Authentication failed') {
        super(message, 401, 'AUTHENTICATION_ERROR');
        this.name = 'N8nAuthenticationError';
    }
}
exports.N8nAuthenticationError = N8nAuthenticationError;
class N8nNotFoundError extends N8nApiError {
    constructor(messageOrResource, id) {
        const message = id ? `${messageOrResource} with ID ${id} not found` : messageOrResource;
        super(message, 404, 'NOT_FOUND');
        this.name = 'N8nNotFoundError';
    }
}
exports.N8nNotFoundError = N8nNotFoundError;
class N8nValidationError extends N8nApiError {
    constructor(message, details) {
        super(message, 400, 'VALIDATION_ERROR', details);
        this.name = 'N8nValidationError';
    }
}
exports.N8nValidationError = N8nValidationError;
class N8nRateLimitError extends N8nApiError {
    constructor(retryAfter) {
        const message = retryAfter
            ? `Rate limit exceeded. Retry after ${retryAfter} seconds`
            : 'Rate limit exceeded';
        super(message, 429, 'RATE_LIMIT_ERROR', { retryAfter });
        this.name = 'N8nRateLimitError';
    }
}
exports.N8nRateLimitError = N8nRateLimitError;
class N8nServerError extends N8nApiError {
    constructor(message = 'Internal server error', statusCode = 500) {
        super(message, statusCode, 'SERVER_ERROR');
        this.name = 'N8nServerError';
    }
}
exports.N8nServerError = N8nServerError;
function handleN8nApiError(error) {
    if (error instanceof N8nApiError) {
        return error;
    }
    if (error instanceof Error) {
        const axiosError = error;
        if (axiosError.response) {
            const { status, data } = axiosError.response;
            const message = data?.message || axiosError.message;
            switch (status) {
                case 401:
                    return new N8nAuthenticationError(message);
                case 404:
                    return new N8nNotFoundError(message || 'Resource');
                case 400:
                    return new N8nValidationError(message, data);
                case 429:
                    const retryAfter = axiosError.response.headers['retry-after'];
                    return new N8nRateLimitError(retryAfter ? parseInt(retryAfter) : undefined);
                default:
                    if (status >= 500) {
                        return new N8nServerError(message, status);
                    }
                    return new N8nApiError(message, status, 'API_ERROR', data);
            }
        }
        else if (axiosError.request) {
            const detail = describeConnectionFailure(axiosError);
            const message = detail
                ? `No response from n8n server (${detail})`
                : 'No response from n8n server';
            return new N8nApiError(message, undefined, 'NO_RESPONSE');
        }
        else {
            return new N8nApiError(axiosError.message, undefined, 'REQUEST_ERROR');
        }
    }
    return new N8nApiError('Unknown error occurred', undefined, 'UNKNOWN_ERROR', error);
}
function formatExecutionError(executionId, workflowId) {
    const workflowPrefix = workflowId ? `Workflow ${workflowId} execution ` : 'Execution ';
    return `${workflowPrefix}${executionId} failed. Use n8n_get_execution({id: '${executionId}', mode: 'preview'}) to investigate the error.`;
}
function formatNoExecutionError() {
    return "Workflow failed to execute. Use n8n_list_executions to find recent executions, then n8n_get_execution with mode='preview' to investigate.";
}
function folderPlacementHint(error) {
    if (error.statusCode !== 400)
        return '';
    const haystack = `${error.message} ${safeStringify(error.details)}`;
    if (!haystack.includes('parentFolderId'))
        return '';
    if (!/additional ?propert/i.test(haystack))
        return '';
    return ' Note: workflow folder placement (parentFolderId) requires n8n 2.32 or later - retry without parentFolderId, or upgrade the instance.';
}
const SETTINGS_ADDITIONAL_PROPERTY = /body\/settings (?:must NOT have additional propert|Unrecognized key\(s\) in object)/i;
const unrecognizedKeysAt = (path) => new RegExp(`${path} Unrecognized key\\(s\\) in object: ((?:'[^']*'(?:,\\s*)?)+)`, 'i');
const parseUnrecognizedKeys = (haystack, path) => {
    const named = unrecognizedKeysAt(path).exec(haystack);
    if (!named)
        return [];
    return [...new Set(Array.from(named[1].matchAll(/'([^']+)'/g), match => match[1]))];
};
function unknownSettingsKeysNamedBy(error) {
    if (!isUnknownSettingsPropertyError(error))
        return [];
    const apiError = error;
    const haystack = `${apiError.message ?? ''} ${safeStringify(apiError.details)}`;
    return parseUnrecognizedKeys(haystack, 'body/settings');
}
function isUnknownSettingsPropertyError(error) {
    const apiError = error;
    if (!apiError || apiError.statusCode !== 400)
        return false;
    return SETTINGS_ADDITIONAL_PROPERTY.test(`${apiError.message ?? ''} ${safeStringify(apiError.details)}`);
}
function enrichUnknownPropertyError(error, sentBody) {
    if (error.statusCode !== 400)
        return error;
    const detailsStr = safeStringify(error.details);
    const haystack = `${error.message} ${detailsStr}`;
    const settingsLevel = SETTINGS_ADDITIONAL_PROPERTY.test(haystack);
    const bodyLevel = !settingsLevel && /body (?:must NOT have additional propert|Unrecognized key\(s\) in object)/i.test(haystack);
    if (!settingsLevel && !bodyLevel)
        return error;
    const namedMatches = Array.from(detailsStr.matchAll(/"additionalProperty"\s*:\s*"([^"]+)"/g), match => match[1]);
    const zodNamed = parseUnrecognizedKeys(haystack, settingsLevel ? 'body/settings' : 'body');
    const named = namedMatches.length > 0 && namedMatches.every(name => name === namedMatches[0])
        ? namedMatches[0]
        : zodNamed.length > 0
            ? zodNamed.join(', ')
            : undefined;
    const parts = [];
    if (named) {
        parts.push(`n8n identified the rejected property: ${named}.`);
    }
    else if (settingsLevel) {
        const settings = sentBody.settings;
        const sentKeys = settings && typeof settings === 'object' && !Array.isArray(settings)
            ? Object.keys(settings)
            : [];
        parts.push(`Settings keys sent: ${sentKeys.join(', ') || '(none)'}.`);
        const unknown = sentKeys.filter(key => !Object.prototype.hasOwnProperty.call(workflow_settings_1.WORKFLOW_SETTINGS_PROPERTIES, key));
        if (unknown.length > 0) {
            parts.push(`Not in n8n-mcp's known settings table: ${unknown.join(', ')}.`);
        }
        parts.push('This usually means the instance stores a setting its Public API write schema rejects ' +
            '(entity-vs-schema drift). Please report the offending key at ' +
            'https://github.com/czlonkowski/n8n-mcp/issues.');
    }
    else {
        parts.push(`Top-level keys sent: ${Object.keys(sentBody).join(', ') || '(none)'}.`);
        parts.push("One of these keys is not accepted by this instance's Public API write schema. " +
            'Please report the offending key at https://github.com/czlonkowski/n8n-mcp/issues.');
    }
    return new N8nValidationError(`${error.message} ${parts.join(' ')}`, error.details);
}
function describeConnectionFailure(axiosError) {
    const parts = [];
    const seen = new Set();
    const addPart = (source) => {
        if (!source || !source.code)
            return;
        let part = String(source.code);
        if (source.address) {
            const host = String(source.address).includes(':') ? `[${source.address}]` : source.address;
            part += source.port !== undefined ? ` ${host}:${source.port}` : ` ${host}`;
        }
        if (!seen.has(part)) {
            seen.add(part);
            parts.push(part);
        }
    };
    const aggregateMembers = axiosError?.errors ?? axiosError?.cause?.errors;
    if (Array.isArray(aggregateMembers) && aggregateMembers.length > 0) {
        aggregateMembers.forEach(addPart);
    }
    if (parts.length === 0) {
        addPart(axiosError);
    }
    if (parts.length === 0) {
        addPart(axiosError?.cause);
    }
    return parts.join(', ');
}
function safeStringify(value) {
    try {
        return JSON.stringify(value) ?? '';
    }
    catch {
        return '';
    }
}
function getUserFriendlyErrorMessage(error) {
    switch (error.code) {
        case 'AUTHENTICATION_ERROR':
            return 'Failed to authenticate with n8n. Please check your API key.';
        case 'NOT_FOUND':
            return error.message;
        case 'VALIDATION_ERROR':
            return `Invalid request: ${error.message}${folderPlacementHint(error)}`;
        case 'RATE_LIMIT_ERROR':
            return 'Too many requests. Please wait a moment and try again.';
        case 'NO_RESPONSE': {
            const generic = 'Unable to connect to n8n. Please check the server URL and ensure n8n is running.';
            const message = error.message.trimEnd();
            const open = message.lastIndexOf('(');
            const detail = message.endsWith(')') && open !== -1
                ? message.slice(open + 1, -1)
                : '';
            return detail && !detail.includes(')') ? `${generic} (${detail})` : generic;
        }
        case 'SERVER_ERROR':
            return error.message || 'n8n server error occurred';
        default:
            return error.message || 'An unexpected error occurred';
    }
}
function logN8nError(error, context) {
    const errorInfo = {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
        context,
    };
    if (error.statusCode && error.statusCode >= 500) {
        logger_1.logger.error('n8n API server error', errorInfo);
    }
    else if (error.statusCode && error.statusCode >= 400) {
        logger_1.logger.warn('n8n API client error', errorInfo);
    }
    else {
        logger_1.logger.error('n8n API error', errorInfo);
    }
}
//# sourceMappingURL=n8n-errors.js.map