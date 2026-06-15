"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolValidation = exports.Validator = exports.ValidationError = void 0;
exports.encodeApiPathSegment = encodeApiPathSegment;
class ValidationError extends Error {
    constructor(message, field, value) {
        super(message);
        this.field = field;
        this.value = value;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
const API_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;
const API_PATH_SEGMENT_MAX_LENGTH = 128;
function encodeApiPathSegment(value, fieldName) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new ValidationError(`${fieldName} is required and must be a non-empty string`, fieldName, value);
    }
    if (value.length > API_PATH_SEGMENT_MAX_LENGTH) {
        throw new ValidationError(`${fieldName} exceeds maximum length of ${API_PATH_SEGMENT_MAX_LENGTH} characters`, fieldName);
    }
    if (!API_PATH_SEGMENT_PATTERN.test(value)) {
        throw new ValidationError(`Invalid ${fieldName}: must contain only alphanumeric characters, hyphens, or underscores`, fieldName, value);
    }
    return encodeURIComponent(value);
}
class Validator {
    static validateString(value, fieldName, required = true) {
        const errors = [];
        if (required && (value === undefined || value === null)) {
            errors.push({
                field: fieldName,
                message: `${fieldName} is required`,
                value
            });
        }
        else if (value !== undefined && value !== null && typeof value !== 'string') {
            errors.push({
                field: fieldName,
                message: `${fieldName} must be a string, got ${typeof value}`,
                value
            });
        }
        else if (required && typeof value === 'string' && value.trim().length === 0) {
            errors.push({
                field: fieldName,
                message: `${fieldName} cannot be empty`,
                value
            });
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    static validateObject(value, fieldName, required = true) {
        const errors = [];
        if (required && (value === undefined || value === null)) {
            errors.push({
                field: fieldName,
                message: `${fieldName} is required`,
                value
            });
        }
        else if (value !== undefined && value !== null) {
            if (typeof value !== 'object') {
                errors.push({
                    field: fieldName,
                    message: `${fieldName} must be an object, got ${typeof value}`,
                    value
                });
            }
            else if (Array.isArray(value)) {
                errors.push({
                    field: fieldName,
                    message: `${fieldName} must be an object, not an array`,
                    value
                });
            }
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    static validateArray(value, fieldName, required = true) {
        const errors = [];
        if (required && (value === undefined || value === null)) {
            errors.push({
                field: fieldName,
                message: `${fieldName} is required`,
                value
            });
        }
        else if (value !== undefined && value !== null && !Array.isArray(value)) {
            errors.push({
                field: fieldName,
                message: `${fieldName} must be an array, got ${typeof value}`,
                value
            });
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    static validateNumber(value, fieldName, required = true, min, max) {
        const errors = [];
        if (required && (value === undefined || value === null)) {
            errors.push({
                field: fieldName,
                message: `${fieldName} is required`,
                value
            });
        }
        else if (value !== undefined && value !== null) {
            if (typeof value !== 'number' || isNaN(value)) {
                errors.push({
                    field: fieldName,
                    message: `${fieldName} must be a number, got ${typeof value}`,
                    value
                });
            }
            else {
                if (min !== undefined && value < min) {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} must be at least ${min}, got ${value}`,
                        value
                    });
                }
                if (max !== undefined && value > max) {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} must be at most ${max}, got ${value}`,
                        value
                    });
                }
            }
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    static validateEnum(value, fieldName, allowedValues, required = true) {
        const errors = [];
        if (required && (value === undefined || value === null)) {
            errors.push({
                field: fieldName,
                message: `${fieldName} is required`,
                value
            });
        }
        else if (value !== undefined && value !== null && !allowedValues.includes(value)) {
            errors.push({
                field: fieldName,
                message: `${fieldName} must be one of: ${allowedValues.join(', ')}, got "${value}"`,
                value
            });
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    static combineResults(...results) {
        const allErrors = results.flatMap(r => r.errors);
        return {
            valid: allErrors.length === 0,
            errors: allErrors
        };
    }
    static formatErrors(result, toolName) {
        if (result.valid)
            return '';
        const prefix = toolName ? `${toolName}: ` : '';
        const errors = result.errors.map(e => `  • ${e.field}: ${e.message}`).join('\n');
        return `${prefix}Validation failed:\n${errors}`;
    }
}
exports.Validator = Validator;
class ToolValidation {
    static validateNodeOperation(args) {
        const nodeTypeResult = Validator.validateString(args.nodeType, 'nodeType');
        const configResult = Validator.validateObject(args.config, 'config');
        const profileResult = Validator.validateEnum(args.profile, 'profile', ['minimal', 'runtime', 'ai-friendly', 'strict'], false);
        return Validator.combineResults(nodeTypeResult, configResult, profileResult);
    }
    static validateNodeMinimal(args) {
        const nodeTypeResult = Validator.validateString(args.nodeType, 'nodeType');
        const configResult = Validator.validateObject(args.config, 'config');
        return Validator.combineResults(nodeTypeResult, configResult);
    }
    static validateWorkflow(args) {
        const workflowResult = Validator.validateObject(args.workflow, 'workflow');
        let nodesResult = { valid: true, errors: [] };
        let connectionsResult = { valid: true, errors: [] };
        if (workflowResult.valid && args.workflow) {
            nodesResult = Validator.validateArray(args.workflow.nodes, 'workflow.nodes');
            connectionsResult = Validator.validateObject(args.workflow.connections, 'workflow.connections');
        }
        const optionsResult = args.options ?
            Validator.validateObject(args.options, 'options', false) :
            { valid: true, errors: [] };
        return Validator.combineResults(workflowResult, nodesResult, connectionsResult, optionsResult);
    }
    static validateSearchNodes(args) {
        const queryResult = Validator.validateString(args.query, 'query');
        const limitResult = Validator.validateNumber(args.limit, 'limit', false, 1, 200);
        const modeResult = Validator.validateEnum(args.mode, 'mode', ['OR', 'AND', 'FUZZY'], false);
        return Validator.combineResults(queryResult, limitResult, modeResult);
    }
    static validateListNodeTemplates(args) {
        const nodeTypesResult = Validator.validateArray(args.nodeTypes, 'nodeTypes');
        const limitResult = Validator.validateNumber(args.limit, 'limit', false, 1, 50);
        return Validator.combineResults(nodeTypesResult, limitResult);
    }
    static validateWorkflowId(args) {
        return Validator.validateString(args.id, 'id');
    }
    static validateCreateWorkflow(args) {
        const nameResult = Validator.validateString(args.name, 'name');
        const nodesResult = Validator.validateArray(args.nodes, 'nodes');
        const connectionsResult = Validator.validateObject(args.connections, 'connections');
        const settingsResult = args.settings ?
            Validator.validateObject(args.settings, 'settings', false) :
            { valid: true, errors: [] };
        return Validator.combineResults(nameResult, nodesResult, connectionsResult, settingsResult);
    }
}
exports.ToolValidation = ToolValidation;
//# sourceMappingURL=validation-schemas.js.map