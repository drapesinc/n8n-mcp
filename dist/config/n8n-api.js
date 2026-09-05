"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getN8nApiConfig = getN8nApiConfig;
exports.isN8nApiConfigured = isN8nApiConfigured;
exports.getN8nApiConfigFromContext = getN8nApiConfigFromContext;
exports.isValidMcpAccessToken = isValidMcpAccessToken;
exports.deriveOfficialMcpEndpoint = deriveOfficialMcpEndpoint;
exports.getOfficialMcpConfigFromContext = getOfficialMcpConfigFromContext;
exports.getOfficialMcpConfig = getOfficialMcpConfig;
exports.isOfficialMcpConfigured = isOfficialMcpConfigured;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
const n8nApiConfigSchema = zod_1.z.object({
    N8N_API_URL: zod_1.z.string().url().optional(),
    N8N_API_KEY: zod_1.z.string().min(1).optional(),
    N8N_API_TIMEOUT: zod_1.z.coerce.number().positive().default(30000),
    N8N_API_MAX_RETRIES: zod_1.z.coerce.number().positive().default(3),
    N8N_CF_CLIENT_ID: zod_1.z.string().trim().optional(),
    N8N_CF_CLIENT_SECRET: zod_1.z.string().trim().optional(),
});
let envLoaded = false;
function getN8nApiConfig() {
    if (!envLoaded) {
        dotenv_1.default.config();
        envLoaded = true;
    }
    const result = n8nApiConfigSchema.safeParse(process.env);
    if (!result.success) {
        return null;
    }
    const config = result.data;
    if (!config.N8N_API_URL || !config.N8N_API_KEY) {
        return null;
    }
    return {
        baseUrl: config.N8N_API_URL,
        apiKey: config.N8N_API_KEY,
        timeout: config.N8N_API_TIMEOUT,
        maxRetries: config.N8N_API_MAX_RETRIES,
        cfClientId: config.N8N_CF_CLIENT_ID,
        cfClientSecret: config.N8N_CF_CLIENT_SECRET,
    };
}
function isN8nApiConfigured() {
    const config = getN8nApiConfig();
    return config !== null;
}
function getN8nApiConfigFromContext(context) {
    if (!context.n8nApiUrl || !context.n8nApiKey) {
        return null;
    }
    return {
        baseUrl: context.n8nApiUrl,
        apiKey: context.n8nApiKey,
        timeout: context.n8nApiTimeout ?? 30000,
        maxRetries: context.n8nApiMaxRetries ?? 3,
        cfClientId: undefined,
        cfClientSecret: undefined,
    };
}
const MCP_ACCESS_TOKEN_MAX_BYTES = 4096;
function isValidMcpAccessToken(token) {
    return typeof token === 'string'
        && token.length > 0
        && !/\s/.test(token)
        && Buffer.byteLength(token, 'utf8') <= MCP_ACCESS_TOKEN_MAX_BYTES;
}
function deriveOfficialMcpEndpoint(instanceUrl) {
    return new URL(instanceUrl).origin + '/mcp-server/http';
}
function getOfficialMcpConfigFromContext(context) {
    if (!context.n8nApiUrl || !isValidMcpAccessToken(context.n8nMcpAccessToken))
        return null;
    try {
        return { endpoint: deriveOfficialMcpEndpoint(context.n8nApiUrl), token: context.n8nMcpAccessToken };
    }
    catch {
        return null;
    }
}
function getOfficialMcpConfig() {
    const api = getN8nApiConfig();
    if (!api)
        return null;
    return getOfficialMcpConfigFromContext({
        n8nApiUrl: api.baseUrl,
        n8nMcpAccessToken: process.env.N8N_MCP_ACCESS_TOKEN,
    });
}
function isOfficialMcpConfigured() {
    return getOfficialMcpConfig() !== null;
}
//# sourceMappingURL=n8n-api.js.map