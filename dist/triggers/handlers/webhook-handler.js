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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookHandler = void 0;
const zod_1 = require("zod");
const base_handler_1 = require("./base-handler");
const trigger_detector_1 = require("../trigger-detector");
const webhookInputSchema = zod_1.z.object({
    workflowId: zod_1.z.string(),
    triggerType: zod_1.z.literal('webhook'),
    httpMethod: zod_1.z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
    webhookPath: zod_1.z.string().optional(),
    data: zod_1.z.record(zod_1.z.unknown()).optional(),
    headers: zod_1.z.record(zod_1.z.string()).optional(),
    timeout: zod_1.z.number().optional(),
    waitForResponse: zod_1.z.boolean().optional(),
});
class WebhookHandler extends base_handler_1.BaseTriggerHandler {
    constructor() {
        super(...arguments);
        this.triggerType = 'webhook';
        this.capabilities = {
            requiresActiveWorkflow: true,
            supportedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
            canPassInputData: true,
        };
        this.inputSchema = webhookInputSchema;
    }
    async execute(input, workflow, triggerInfo) {
        const startTime = Date.now();
        try {
            const baseUrl = this.getBaseUrl();
            if (!baseUrl) {
                return this.errorResponse(input, 'Cannot determine n8n base URL', startTime);
            }
            let webhookUrl;
            if (input.webhookPath) {
                webhookUrl = `${baseUrl.replace(/\/+$/, '')}/webhook/${input.webhookPath}`;
            }
            else if (triggerInfo?.webhookPath) {
                webhookUrl = (0, trigger_detector_1.buildTriggerUrl)(baseUrl, triggerInfo, 'production');
            }
            else {
                return this.errorResponse(input, 'No webhook path available. Provide webhookPath parameter or ensure workflow has a webhook trigger.', startTime);
            }
            if (!this.isUnderTriggerPrefix(webhookUrl, baseUrl, 'webhook')) {
                return this.errorResponse(input, 'Invalid webhook path', startTime);
            }
            const httpMethod = input.httpMethod || triggerInfo?.httpMethod || 'POST';
            const { SSRFProtection } = await Promise.resolve().then(() => __importStar(require('../../utils/ssrf-protection')));
            const validation = await SSRFProtection.validateWebhookUrl(webhookUrl);
            if (!validation.valid) {
                return this.errorResponse(input, `SSRF protection: ${validation.reason}`, startTime);
            }
            const webhookRequest = {
                webhookUrl,
                httpMethod: httpMethod,
                data: input.data,
                headers: input.headers,
                waitForResponse: input.waitForResponse ?? true,
            };
            const response = await this.client.triggerWebhook(webhookRequest);
            return this.normalizeResponse(response, input, startTime, {
                status: response.status,
                statusText: response.statusText,
                metadata: {
                    duration: Date.now() - startTime,
                    webhookPath: input.webhookPath || triggerInfo?.webhookPath,
                    httpMethod,
                },
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorDetails = error?.details;
            const executionId = errorDetails?.executionId || errorDetails?.id;
            return this.errorResponse(input, errorMessage, startTime, {
                executionId,
                code: error?.code,
                details: errorDetails,
            });
        }
    }
}
exports.WebhookHandler = WebhookHandler;
//# sourceMappingURL=webhook-handler.js.map