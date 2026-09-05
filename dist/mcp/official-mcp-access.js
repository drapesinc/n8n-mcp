"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveOfficialMcpConfig = resolveOfficialMcpConfig;
exports.getOfficialMcpClient = getOfficialMcpClient;
exports.notConfiguredResponse = notConfiguredResponse;
exports.officialErrorText = officialErrorText;
exports.officialFailure = officialFailure;
exports.buildOfficialMcpHealth = buildOfficialMcpHealth;
exports.clearOfficialMcpClientCache = clearOfficialMcpClientCache;
const n8n_api_1 = require("../config/n8n-api");
const n8n_official_mcp_client_1 = require("../services/n8n-official-mcp-client");
const cache_utils_1 = require("../utils/cache-utils");
const logger_1 = require("../utils/logger");
const clientCache = (0, cache_utils_1.createInstanceCache)((client, key) => {
    client.close().catch(err => logger_1.logger.debug('Error closing evicted MCP client', { key: key.slice(0, 8), error: err.message }));
});
function resolveOfficialMcpConfig(context) {
    if (context?.n8nApiUrl && (context?.n8nApiKey || context?.n8nMcpAccessToken)) {
        return (0, n8n_api_1.getOfficialMcpConfigFromContext)(context);
    }
    if (process.env.ENABLE_MULTI_TENANT === 'true') {
        logger_1.logger.warn('Refusing env-credential fallback for official MCP in multi-tenant mode');
        return null;
    }
    return (0, n8n_api_1.getOfficialMcpConfig)();
}
function getOfficialMcpClient(context) {
    const config = resolveOfficialMcpConfig(context);
    if (!config)
        return null;
    const cacheKey = (0, cache_utils_1.createCacheKey)(`${config.endpoint}:${config.token}:${context?.instanceId ?? 'default'}`);
    const cached = clientCache.get(cacheKey);
    if (cached) {
        cache_utils_1.cacheMetrics.recordHit();
        return cached;
    }
    cache_utils_1.cacheMetrics.recordMiss();
    const client = new n8n_official_mcp_client_1.N8nOfficialMcpClient({ endpoint: config.endpoint, token: config.token, instanceId: context?.instanceId });
    clientCache.set(cacheKey, client);
    cache_utils_1.cacheMetrics.recordSet();
    logger_1.logger.info('Created n8n MCP client', { host: new URL(config.endpoint).host, cacheKey: cacheKey.slice(0, 8) + '...' });
    return client;
}
const SETUP_HINT_MAX_LENGTH = 500;
function embedderSetupHint(context) {
    const raw = context?.metadata?.officialMcpSetupHint;
    if (typeof raw !== 'string')
        return undefined;
    const bounded = raw.slice(0, SETUP_HINT_MAX_LENGTH * 2);
    const stripped = bounded
        .replace(/[<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (stripped.length === 0)
        return undefined;
    return stripped.slice(0, SETUP_HINT_MAX_LENGTH);
}
function notConfiguredResponse(context, action) {
    return {
        success: false,
        action,
        code: 'NOT_CONFIGURED',
        error: 'n8n instance-level MCP access is not configured for this instance',
        hint: embedderSetupHint(context) ?? n8n_official_mcp_client_1.OFFICIAL_MCP_HINTS.NOT_CONFIGURED,
    };
}
function officialErrorText(data, officialCode) {
    const obj = data;
    const raw = typeof obj?.message === 'string'
        ? obj.message
        : typeof obj?.error === 'string'
            ? obj.error
            : typeof data === 'string'
                ? data
                : `n8n returned ${officialCode ?? 'an error'}`;
    return String(raw).slice(0, 2000);
}
function officialFailure(err, action) {
    const mapped = err instanceof n8n_official_mcp_client_1.OfficialMcpError ? err : (0, n8n_official_mcp_client_1.mapOfficialTransportError)(err);
    return {
        success: false,
        action,
        code: mapped.code,
        error: mapped.message,
        hint: mapped.hint,
        ...(mapped.status !== undefined ? { details: { status: mapped.status } } : {}),
    };
}
async function buildOfficialMcpHealth(context, live) {
    const config = resolveOfficialMcpConfig(context);
    if (!config)
        return { configured: false, hint: embedderSetupHint(context) ?? n8n_official_mcp_client_1.OFFICIAL_MCP_HINTS.NOT_CONFIGURED };
    const client = getOfficialMcpClient(context);
    const caps = live ? await client.capabilities(true) : client.cachedCapabilities();
    if (!caps)
        return { configured: true, endpoint: config.endpoint };
    return {
        configured: true,
        endpoint: config.endpoint,
        reachable: caps.reachable,
        toolCount: caps.toolCount,
        agentTools: caps.agentTools,
        checkedAt: new Date(caps.checkedAt).toISOString(),
        ...(caps.error ? { error: caps.error, hint: n8n_official_mcp_client_1.OFFICIAL_MCP_HINTS[caps.error] } : {}),
    };
}
async function clearOfficialMcpClientCache() {
    const clients = [...clientCache.values()];
    clientCache.clear();
    await Promise.all(clients.map(c => c.close().catch(() => undefined)));
}
//# sourceMappingURL=official-mcp-access.js.map