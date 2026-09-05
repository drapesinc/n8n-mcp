"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.N8nOfficialMcpClient = exports.OFFICIAL_RESULT_MAX_BYTES = exports.OFFICIAL_MCP_FAILURE_TTL_MS = exports.OFFICIAL_MCP_CACHE_TTL_MS = exports.AGENT_TOOL_NAMES = exports.OfficialMcpError = exports.OFFICIAL_MCP_HINTS = void 0;
exports.mapOfficialTransportError = mapOfficialTransportError;
exports.probeOfficialMcp = probeOfficialMcp;
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const ssrf_protection_1 = require("../utils/ssrf-protection");
const version_1 = require("../utils/version");
const logger_1 = require("../utils/logger");
const PERMISSIVE_JSON_SCHEMA_VALIDATOR = {
    getValidator: () => (input) => ({ valid: true, data: input, errorMessage: undefined }),
};
exports.OFFICIAL_MCP_HINTS = {
    NOT_CONFIGURED: 'Set N8N_MCP_ACCESS_TOKEN to the MCP API key from n8n Settings → Instance-level MCP → set MCP status to Enabled (a separate key from N8N_API_KEY). The endpoint is derived from N8N_API_URL.',
    OFFICIAL_MCP_AUTH_FAILED: 'The MCP access token was rejected. Regenerate it in n8n Settings → Instance-level MCP and update N8N_MCP_ACCESS_TOKEN.',
    OFFICIAL_MCP_NOT_ENABLED: 'n8n did not answer as an MCP server at <origin>/mcp-server/http. Enable instance-level MCP access in Settings (n8n >= 2.18.4), or the instance serves MCP from a different host (N8N_MCP_BASE_URL), which is not supported.',
    OFFICIAL_MCP_RATE_LIMITED: 'n8n limits the MCP server to 100 requests per window per token. Wait and retry.',
    OFFICIAL_MCP_TOOL_UNAVAILABLE: 'This n8n instance does not expose the required tool. Agents need n8n >= 2.34 with the agents module enabled; other tools depend on the n8n version.',
    OFFICIAL_MCP_URL_REJECTED: 'The derived MCP endpoint failed URL safety validation (private or reserved address). Use a public instance URL, or WEBHOOK_SECURITY_MODE=moderate for local development.',
    OFFICIAL_MCP_TIMEOUT: 'The request exceeded timeoutMs. The run continues in n8n: check n8n_executions for the execution, reuse the sessionId if you have one instead of re-sending the message, or raise timeoutMs.',
    OFFICIAL_MCP_TRANSPORT_ERROR: 'Could not complete the request to n8n\'s MCP server. Check that the instance is reachable and try again.',
};
class OfficialMcpError extends Error {
    constructor(code, message, status, retryable = false) {
        super(message);
        this.code = code;
        this.status = status;
        this.retryable = retryable;
        this.name = 'OfficialMcpError';
    }
    get hint() { return exports.OFFICIAL_MCP_HINTS[this.code]; }
}
exports.OfficialMcpError = OfficialMcpError;
exports.AGENT_TOOL_NAMES = [
    'search_agents', 'get_agent', 'create_agent', 'mutate_agent', 'validate_agent', 'call_agent',
    'publish_agent', 'unpublish_agent', 'revert_agent', 'list_agent_versions', 'delete_agent',
    'discover_agent_assets', 'verify_agent_mcp_server', 'update_agent_integration', 'get_agent_builder_reference',
];
exports.OFFICIAL_MCP_CACHE_TTL_MS = 10 * 60 * 1000;
exports.OFFICIAL_MCP_FAILURE_TTL_MS = 30000;
exports.OFFICIAL_RESULT_MAX_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 30000;
function mapOfficialTransportError(err) {
    if (err instanceof OfficialMcpError)
        return err;
    if (err instanceof streamableHttp_js_1.StreamableHTTPError) {
        const status = err.code;
        if (status === 401 || status === 403)
            return new OfficialMcpError('OFFICIAL_MCP_AUTH_FAILED', 'n8n rejected the MCP access token', status);
        if (status === 404 || status === -1)
            return new OfficialMcpError('OFFICIAL_MCP_NOT_ENABLED', 'No MCP server at the derived endpoint', status === -1 ? undefined : status);
        if (status === 429)
            return new OfficialMcpError('OFFICIAL_MCP_RATE_LIMITED', 'n8n MCP server rate limit reached', status);
        if (status !== undefined && status >= 300 && status < 400) {
            return new OfficialMcpError('OFFICIAL_MCP_TRANSPORT_ERROR', `n8n MCP server returned HTTP ${status}; redirects are not followed`, status);
        }
        return new OfficialMcpError('OFFICIAL_MCP_TRANSPORT_ERROR', `n8n MCP server returned HTTP ${status}`, status ?? undefined);
    }
    if (err instanceof types_js_1.McpError) {
        if (err.code === types_js_1.ErrorCode.RequestTimeout) {
            return new OfficialMcpError('OFFICIAL_MCP_TIMEOUT', 'Request to n8n MCP server timed out');
        }
        if (err.code === types_js_1.ErrorCode.InvalidParams) {
            return new OfficialMcpError('OFFICIAL_MCP_TRANSPORT_ERROR', 'n8n MCP server rejected the request arguments (JSON-RPC -32602)');
        }
        if (err.code === types_js_1.ErrorCode.InvalidRequest) {
            return new OfficialMcpError('OFFICIAL_MCP_TRANSPORT_ERROR', 'n8n returned a result without structured content for a tool that declares an output schema (JSON-RPC -32600)');
        }
        const code = typeof err.code === 'number' ? err.code : 'unknown';
        return new OfficialMcpError('OFFICIAL_MCP_TRANSPORT_ERROR', `n8n MCP server returned a protocol error (JSON-RPC code ${code})`);
    }
    if (err instanceof Error) {
        return new OfficialMcpError('OFFICIAL_MCP_TRANSPORT_ERROR', err.message.slice(0, 200), undefined, true);
    }
    return new OfficialMcpError('OFFICIAL_MCP_TRANSPORT_ERROR', 'Request to n8n MCP server failed');
}
function structuredSize(value) {
    try {
        return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
    }
    catch {
        return exports.OFFICIAL_RESULT_MAX_BYTES + 1;
    }
}
function boundedFailureProjection(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const root = value;
    const flag = root.success === false ? 'success' : root.ok === false ? 'ok' : undefined;
    if (!flag)
        return undefined;
    const message = typeof root.error === 'string' ? root.error
        : typeof root.message === 'string' ? root.message
            : 'n8n returned an error payload too large to include';
    return {
        [flag]: false,
        error: message.slice(0, 2000),
        ...(typeof root.code === 'string' ? { code: root.code } : {}),
    };
}
function parseResult(raw) {
    let text = (raw.content ?? []).filter(c => c.type === 'text' && typeof c.text === 'string').map(c => c.text).join('\n');
    const textBytes = Buffer.byteLength(text, 'utf8');
    let truncated = textBytes > exports.OFFICIAL_RESULT_MAX_BYTES;
    if (truncated)
        text = Buffer.from(text, 'utf8').subarray(0, exports.OFFICIAL_RESULT_MAX_BYTES).toString('utf8') + '\n…[truncated]';
    let json = raw.structuredContent;
    let structuredBytes = 0;
    if (json !== undefined) {
        structuredBytes = structuredSize(json);
        if (structuredBytes > exports.OFFICIAL_RESULT_MAX_BYTES) {
            json = boundedFailureProjection(json);
            truncated = true;
        }
    }
    if (json === undefined && !truncated) {
        const trimmed = text.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                json = JSON.parse(trimmed);
            }
            catch { }
        }
    }
    return { isError: raw.isError === true, text, json, sizeBytes: Math.max(textBytes, structuredBytes), truncated };
}
async function closeTransport(client, pinned) {
    await client?.close().catch(() => undefined);
    await pinned?.close().catch(() => undefined);
}
class N8nOfficialMcpClient {
    constructor(opts) {
        this.client = null;
        this.pinned = null;
        this.connecting = null;
        this.caps = null;
        this.ref = null;
        this.generation = 0;
        this.closed = false;
        this.hasConnectedSuccessfully = false;
        this.endpoint = opts.endpoint;
        this.token = opts.token;
        this.host = new URL(opts.endpoint).host;
    }
    async connect() {
        if (this.closed)
            throw new OfficialMcpError('OFFICIAL_MCP_TRANSPORT_ERROR', 'Client is closed');
        if (this.client)
            return { client: this.client, generation: this.generation };
        if (this.connecting)
            return this.connecting;
        const myGeneration = this.generation;
        this.connecting = (async () => {
            const validation = await ssrf_protection_1.SSRFProtection.validateWebhookUrl(this.endpoint);
            if (!validation.valid)
                throw new OfficialMcpError('OFFICIAL_MCP_URL_REJECTED', validation.reason || 'Endpoint rejected');
            if (this.closed || this.generation !== myGeneration) {
                throw new OfficialMcpError('OFFICIAL_MCP_TRANSPORT_ERROR', 'Client was closed while connecting');
            }
            const addresses = validation.addresses ?? (validation.address ? [{ address: validation.address, family: validation.family }] : []);
            const pinned = ssrf_protection_1.SSRFProtection.createPinnedFetch(addresses);
            const transport = new streamableHttp_js_1.StreamableHTTPClientTransport(new URL(this.endpoint), {
                requestInit: { headers: { Authorization: `Bearer ${this.token}` } },
                fetch: pinned.fetch,
            });
            const client = new index_js_1.Client({ name: 'n8n-mcp', version: version_1.PROJECT_VERSION }, { capabilities: {}, jsonSchemaValidator: PERMISSIVE_JSON_SCHEMA_VALIDATOR });
            try {
                await client.connect(transport, { timeout: DEFAULT_TIMEOUT_MS });
            }
            catch (err) {
                await pinned.close().catch(() => undefined);
                throw mapOfficialTransportError(err);
            }
            if (this.closed || this.generation !== myGeneration) {
                await closeTransport(client, pinned);
                throw new OfficialMcpError('OFFICIAL_MCP_TRANSPORT_ERROR', 'Client was closed while connecting');
            }
            this.client = client;
            this.pinned = pinned;
            this.hasConnectedSuccessfully = true;
            logger_1.logger.debug('Connected to n8n MCP server', { host: this.host });
            return { client, generation: this.generation };
        })();
        try {
            return await this.connecting;
        }
        finally {
            this.connecting = null;
        }
    }
    async resetTransport(generation) {
        if (generation !== this.generation)
            return;
        const client = this.client;
        const pinned = this.pinned;
        this.client = null;
        this.pinned = null;
        this.generation++;
        await closeTransport(client, pinned);
    }
    async capabilities(force = false) {
        const ttl = this.caps?.reachable === false ? exports.OFFICIAL_MCP_FAILURE_TTL_MS : exports.OFFICIAL_MCP_CACHE_TTL_MS;
        if (!force && this.caps && Date.now() - this.caps.checkedAt < ttl)
            return this.caps;
        let generation;
        try {
            const connected = await this.connect();
            generation = connected.generation;
            const { tools } = await connected.client.listTools(undefined, { timeout: DEFAULT_TIMEOUT_MS });
            const toolNames = tools.map(t => t.name);
            this.caps = { reachable: true, toolCount: toolNames.length, toolNames, agentTools: toolNames.some(n => exports.AGENT_TOOL_NAMES.includes(n)), checkedAt: Date.now() };
        }
        catch (err) {
            const mapped = mapOfficialTransportError(err);
            if (mapped.retryable && generation !== undefined)
                await this.resetTransport(generation);
            this.caps = { reachable: false, toolCount: 0, toolNames: [], agentTools: false, checkedAt: Date.now(), error: mapped.code };
        }
        return this.caps;
    }
    async hasTool(name) {
        const caps = await this.capabilities();
        return caps.toolNames.includes(name);
    }
    async callTool(name, args, opts = {}) {
        const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const state = {};
        const attempt = async () => {
            const { client, generation } = await this.connect();
            state.generation = generation;
            const raw = await client.callTool({ name, arguments: args }, undefined, { timeout });
            return parseResult(raw);
        };
        logger_1.logger.debug('Calling n8n MCP tool', { host: this.host, tool: name });
        try {
            return await attempt();
        }
        catch (err) {
            const mapped = mapOfficialTransportError(err);
            if (!mapped.retryable)
                throw mapped;
            if (state.generation !== undefined)
                await this.resetTransport(state.generation);
            if (!this.hasConnectedSuccessfully || opts.idempotent !== true)
                throw mapped;
            try {
                return await attempt();
            }
            catch (again) {
                const mappedAgain = mapOfficialTransportError(again);
                if (mappedAgain.retryable && state.generation !== undefined) {
                    await this.resetTransport(state.generation);
                }
                throw mappedAgain;
            }
        }
    }
    async reference(tool = 'get_agent_builder_reference') {
        if (this.ref && Date.now() - this.ref.at < exports.OFFICIAL_MCP_CACHE_TTL_MS)
            return this.ref.value;
        const result = await this.callTool(tool, {}, { idempotent: true });
        const value = (result.json && typeof result.json === 'object' ? result.json : { guide: result.text });
        if (result.isError || value.ok === false) {
            throw new OfficialMcpError('OFFICIAL_MCP_TOOL_UNAVAILABLE', 'n8n did not return the agent builder reference');
        }
        this.ref = { value, at: Date.now() };
        return value;
    }
    cachedCapabilities() {
        return this.caps;
    }
    async close() {
        this.closed = true;
        this.generation++;
        if (this.connecting)
            await this.connecting.catch(() => undefined);
        const client = this.client;
        const pinned = this.pinned;
        this.client = null;
        this.pinned = null;
        await closeTransport(client, pinned);
        this.caps = null;
        this.ref = null;
    }
}
exports.N8nOfficialMcpClient = N8nOfficialMcpClient;
async function probeOfficialMcp(opts) {
    const client = new N8nOfficialMcpClient(opts);
    try {
        return await client.capabilities(true);
    }
    finally {
        await client.close();
    }
}
//# sourceMappingURL=n8n-official-mcp-client.js.map