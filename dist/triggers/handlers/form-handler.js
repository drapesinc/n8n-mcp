"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormHandler = void 0;
const zod_1 = require("zod");
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const base_handler_1 = require("./base-handler");
const formInputSchema = zod_1.z.object({
    workflowId: zod_1.z.string(),
    triggerType: zod_1.z.literal('form'),
    formData: zod_1.z.record(zod_1.z.unknown()).optional(),
    data: zod_1.z.record(zod_1.z.unknown()).optional(),
    headers: zod_1.z.record(zod_1.z.string()).optional(),
    timeout: zod_1.z.number().optional(),
    waitForResponse: zod_1.z.boolean().optional(),
});
const FORM_FIELD_TYPES = {
    TEXT: 'text',
    TEXTAREA: 'textarea',
    EMAIL: 'email',
    NUMBER: 'number',
    PASSWORD: 'password',
    DATE: 'date',
    DROPDOWN: 'dropdown',
    CHECKBOX: 'checkbox',
    FILE: 'file',
    HIDDEN: 'hiddenField',
    HTML: 'html',
};
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
function isValidBase64(str) {
    if (!str || str.length === 0) {
        return false;
    }
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str)) {
        return false;
    }
    try {
        const decoded = Buffer.from(str, 'base64');
        return decoded.toString('base64') === str;
    }
    catch {
        return false;
    }
}
function extractFormFields(workflow, triggerNode) {
    const node = triggerNode || workflow.nodes.find(n => n.type.toLowerCase().includes('formtrigger'));
    const params = node?.parameters;
    const formFields = params?.formFields;
    if (!formFields?.values) {
        return [];
    }
    const fields = [];
    let fieldIndex = 0;
    for (const rawField of formFields.values) {
        const field = rawField;
        const fieldType = field.fieldType || FORM_FIELD_TYPES.TEXT;
        const def = {
            index: fieldIndex,
            fieldName: `field-${fieldIndex}`,
            label: field.fieldLabel || field.fieldName || field.elementName || `field-${fieldIndex}`,
            type: fieldType,
            required: field.requiredField === true,
        };
        if (field.fieldOptions?.values) {
            def.options = field.fieldOptions.values.map((v) => v.option);
        }
        fields.push(def);
        fieldIndex++;
    }
    return fields;
}
function generateFormUsageHint(fields) {
    if (fields.length === 0) {
        return 'No form fields detected in workflow.';
    }
    const lines = ['Form fields (use these keys in data parameter):'];
    for (const field of fields) {
        let hint = `  "${field.fieldName}": `;
        switch (field.type) {
            case FORM_FIELD_TYPES.CHECKBOX:
                hint += `["${field.options?.[0] || 'option1'}", ...]`;
                if (field.options) {
                    hint += ` (options: ${field.options.join(', ')})`;
                }
                break;
            case FORM_FIELD_TYPES.DROPDOWN:
                hint += `"${field.options?.[0] || 'value'}"`;
                if (field.options) {
                    hint += ` (options: ${field.options.join(', ')})`;
                }
                break;
            case FORM_FIELD_TYPES.DATE:
                hint += '"YYYY-MM-DD"';
                break;
            case FORM_FIELD_TYPES.EMAIL:
                hint += '"user@example.com"';
                break;
            case FORM_FIELD_TYPES.NUMBER:
                hint += '123';
                break;
            case FORM_FIELD_TYPES.FILE:
                hint += '{ filename: "test.txt", content: "base64..." } or skip (sends empty file)';
                break;
            case FORM_FIELD_TYPES.PASSWORD:
                hint += '"secret"';
                break;
            case FORM_FIELD_TYPES.TEXTAREA:
                hint += '"multi-line text..."';
                break;
            case FORM_FIELD_TYPES.HTML:
                hint += '"" (display-only, can be omitted)';
                break;
            case FORM_FIELD_TYPES.HIDDEN:
                hint += '"value" (hidden field)';
                break;
            default:
                hint += '"text value"';
        }
        hint += field.required ? ' [REQUIRED]' : '';
        hint += ` // ${field.label}`;
        lines.push(hint);
    }
    return lines.join('\n');
}
class FormHandler extends base_handler_1.BaseTriggerHandler {
    constructor() {
        super(...arguments);
        this.triggerType = 'form';
        this.capabilities = {
            requiresActiveWorkflow: true,
            canPassInputData: true,
        };
        this.inputSchema = formInputSchema;
    }
    async execute(input, workflow, triggerInfo) {
        const startTime = Date.now();
        const formFieldDefs = extractFormFields(workflow, triggerInfo?.node);
        try {
            const baseUrl = this.getBaseUrl();
            if (!baseUrl) {
                return this.errorResponse(input, 'Cannot determine n8n base URL', startTime, {
                    details: {
                        formFields: formFieldDefs,
                        hint: generateFormUsageHint(formFieldDefs),
                    },
                });
            }
            const formPath = triggerInfo?.webhookPath || triggerInfo?.node?.parameters?.path || input.workflowId;
            const formUrl = `${baseUrl.replace(/\/+$/, '')}/form/${formPath}`;
            const inputFields = {
                ...input.data,
                ...input.formData,
            };
            const { SSRFProtection } = await Promise.resolve().then(() => __importStar(require('../../utils/ssrf-protection')));
            const validation = await SSRFProtection.validateWebhookUrl(formUrl);
            if (!validation.valid) {
                return this.errorResponse(input, `SSRF protection: ${validation.reason}`, startTime);
            }
            const pinned = validation.address && validation.family
                ? SSRFProtection.createPinnedAgents(validation.address, validation.family)
                : undefined;
            const formData = new form_data_1.default();
            const warnings = [];
            for (const fieldDef of formFieldDefs) {
                const value = inputFields[fieldDef.fieldName];
                switch (fieldDef.type) {
                    case FORM_FIELD_TYPES.CHECKBOX:
                        if (Array.isArray(value)) {
                            for (const item of value) {
                                formData.append(`${fieldDef.fieldName}[]`, String(item ?? ''));
                            }
                        }
                        else if (value !== undefined && value !== null) {
                            formData.append(`${fieldDef.fieldName}[]`, String(value));
                        }
                        else if (fieldDef.required) {
                            warnings.push(`Required checkbox field "${fieldDef.fieldName}" (${fieldDef.label}) not provided`);
                        }
                        break;
                    case FORM_FIELD_TYPES.FILE:
                        if (value && typeof value === 'object' && 'content' in value) {
                            const fileObj = value;
                            let buffer;
                            if (typeof fileObj.content === 'string') {
                                if (!isValidBase64(fileObj.content)) {
                                    warnings.push(`Invalid base64 encoding for file field "${fieldDef.fieldName}" (${fieldDef.label})`);
                                    buffer = Buffer.from('');
                                }
                                else {
                                    buffer = Buffer.from(fileObj.content, 'base64');
                                    if (buffer.length > MAX_FILE_SIZE_BYTES) {
                                        warnings.push(`File too large for "${fieldDef.fieldName}" (${fieldDef.label}): ${Math.round(buffer.length / 1024 / 1024)}MB exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit`);
                                        buffer = Buffer.from('');
                                    }
                                }
                            }
                            else {
                                buffer = fileObj.content;
                                if (buffer.length > MAX_FILE_SIZE_BYTES) {
                                    warnings.push(`File too large for "${fieldDef.fieldName}" (${fieldDef.label}): ${Math.round(buffer.length / 1024 / 1024)}MB exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit`);
                                    buffer = Buffer.from('');
                                }
                            }
                            formData.append(fieldDef.fieldName, buffer, {
                                filename: fileObj.filename || 'file.txt',
                                contentType: 'application/octet-stream',
                            });
                        }
                        else if (value && typeof value === 'string') {
                            if (!isValidBase64(value)) {
                                warnings.push(`Invalid base64 encoding for file field "${fieldDef.fieldName}" (${fieldDef.label})`);
                                formData.append(fieldDef.fieldName, Buffer.from(''), {
                                    filename: 'empty.txt',
                                    contentType: 'text/plain',
                                });
                            }
                            else {
                                const buffer = Buffer.from(value, 'base64');
                                if (buffer.length > MAX_FILE_SIZE_BYTES) {
                                    warnings.push(`File too large for "${fieldDef.fieldName}" (${fieldDef.label}): ${Math.round(buffer.length / 1024 / 1024)}MB exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit`);
                                    formData.append(fieldDef.fieldName, Buffer.from(''), {
                                        filename: 'empty.txt',
                                        contentType: 'text/plain',
                                    });
                                }
                                else {
                                    formData.append(fieldDef.fieldName, buffer, {
                                        filename: 'file.txt',
                                        contentType: 'application/octet-stream',
                                    });
                                }
                            }
                        }
                        else {
                            formData.append(fieldDef.fieldName, Buffer.from(''), {
                                filename: 'empty.txt',
                                contentType: 'text/plain',
                            });
                            if (fieldDef.required) {
                                warnings.push(`Required file field "${fieldDef.fieldName}" (${fieldDef.label}) not provided - sending empty placeholder`);
                            }
                        }
                        break;
                    case FORM_FIELD_TYPES.HTML:
                        formData.append(fieldDef.fieldName, String(value ?? ''));
                        break;
                    case FORM_FIELD_TYPES.HIDDEN:
                        formData.append(fieldDef.fieldName, String(value ?? ''));
                        break;
                    default:
                        if (value !== undefined && value !== null) {
                            formData.append(fieldDef.fieldName, String(value));
                        }
                        else if (fieldDef.required) {
                            warnings.push(`Required field "${fieldDef.fieldName}" (${fieldDef.label}) not provided`);
                        }
                        break;
                }
            }
            const definedFieldNames = new Set(formFieldDefs.map(f => f.fieldName));
            for (const [key, value] of Object.entries(inputFields)) {
                if (!definedFieldNames.has(key)) {
                    if (Array.isArray(value)) {
                        for (const item of value) {
                            formData.append(`${key}[]`, String(item ?? ''));
                        }
                    }
                    else {
                        formData.append(key, String(value ?? ''));
                    }
                }
            }
            const config = {
                method: 'POST',
                url: formUrl,
                headers: {
                    ...formData.getHeaders(),
                    ...input.headers,
                },
                data: formData,
                timeout: input.timeout || (input.waitForResponse !== false ? 120000 : 30000),
                validateStatus: (status) => status < 500,
                maxRedirects: 0,
                httpAgent: pinned?.httpAgent,
                httpsAgent: pinned?.httpsAgent,
            };
            const response = await axios_1.default.request(config);
            const result = this.normalizeResponse(response.data, input, startTime, {
                status: response.status,
                statusText: response.statusText,
                metadata: {
                    duration: Date.now() - startTime,
                },
            });
            result.details = {
                ...result.details,
                fieldsSubmitted: formFieldDefs.length,
            };
            if (warnings.length > 0) {
                result.details = {
                    ...result.details,
                    warnings,
                };
            }
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorDetails = error?.response?.data;
            const executionId = errorDetails?.executionId || errorDetails?.id;
            return this.errorResponse(input, errorMessage, startTime, {
                executionId,
                code: error?.code,
                details: {
                    ...errorDetails,
                    formFields: formFieldDefs.map(f => ({
                        name: f.fieldName,
                        label: f.label,
                        type: f.type,
                        required: f.required,
                        options: f.options,
                    })),
                    hint: generateFormUsageHint(formFieldDefs),
                },
            });
        }
    }
}
exports.FormHandler = FormHandler;
//# sourceMappingURL=form-handler.js.map