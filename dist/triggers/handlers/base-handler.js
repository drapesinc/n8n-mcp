"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTriggerHandler = void 0;
const n8n_api_1 = require("../../config/n8n-api");
class BaseTriggerHandler {
    constructor(client, context) {
        this.client = client;
        this.context = context;
    }
    validate(input) {
        return this.inputSchema.parse(input);
    }
    getBaseUrl() {
        if (this.context?.n8nApiUrl) {
            return this.context.n8nApiUrl.replace(/\/api\/v1\/?$/, '');
        }
        if (process.env.ENABLE_MULTI_TENANT === 'true') {
            return undefined;
        }
        const config = (0, n8n_api_1.getN8nApiConfig)();
        if (config?.baseUrl) {
            return config.baseUrl.replace(/\/api\/v1\/?$/, '');
        }
        return undefined;
    }
    getApiKey() {
        if (this.context?.n8nApiKey) {
            return this.context.n8nApiKey;
        }
        if (process.env.ENABLE_MULTI_TENANT === 'true') {
            return undefined;
        }
        const config = (0, n8n_api_1.getN8nApiConfig)();
        return config?.apiKey;
    }
    normalizeResponse(result, input, startTime, extra) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        return {
            success: true,
            triggerType: this.triggerType,
            workflowId: input.workflowId,
            data: result,
            metadata: {
                duration,
            },
            ...extra,
        };
    }
    errorResponse(input, error, startTime, extra) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        return {
            success: false,
            triggerType: this.triggerType,
            workflowId: input.workflowId,
            error,
            metadata: {
                duration,
            },
            ...extra,
        };
    }
}
exports.BaseTriggerHandler = BaseTriggerHandler;
//# sourceMappingURL=base-handler.js.map