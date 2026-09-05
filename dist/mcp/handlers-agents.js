"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleManageAgents = handleManageAgents;
const zod_1 = require("zod");
const official_mcp_access_1 = require("./official-mcp-access");
const agents_action_map_1 = require("./agents-action-map");
const n8n_official_mcp_client_1 = require("../services/n8n-official-mcp-client");
const agent_model_providers_1 = require("../constants/agent-model-providers");
const handlers_n8n_manager_1 = require("./handlers-n8n-manager");
const logger_1 = require("../utils/logger");
const inputSchema = zod_1.z.object({
    action: zod_1.z.enum(agents_action_map_1.AGENT_ACTIONS),
    args: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().default({}),
    timeoutMs: zod_1.z.number().int().min(agents_action_map_1.MIN_TIMEOUT_MS).max(agents_action_map_1.MAX_TIMEOUT_MS).optional(),
}).strict();
const OFFICIAL_CODE_MAP = {
    stale_config: {
        code: 'STALE_CONFIG',
        hint: 'The agent config changed since baseConfigHash was read. Call action=get and retry the mutate with the returned configHash.',
    },
    agent_misconfigured: {
        code: 'AGENT_NOT_RUNNABLE',
        hint: 'Run action=validate and fix the listed errors/missing items before calling or publishing.',
    },
    agent_tool_error: {
        code: 'AGENT_TOOL_ERROR',
        hint: "n8n's agent tooling reported an error — see officialError.error. Typical causes: unknown agentId, or a custom tool that failed to compile (TypeScript; only @n8n/agents and zod imports).",
    },
};
function invalid(action, message) {
    return { success: false, action, code: 'INVALID_ARGS', error: message };
}
async function credentialIdFromResult(args, data, client) {
    const direct = data?.config?.credential;
    if (typeof direct === 'string')
        return direct;
    const agentId = args.agentId;
    if (typeof agentId !== 'string')
        return undefined;
    try {
        const result = await client.callTool('get_agent', { agentId }, { timeoutMs: agents_action_map_1.DEFAULT_TIMEOUT_MS, idempotent: true });
        const credential = result.json?.config?.credential;
        return typeof credential === 'string' ? credential : undefined;
    }
    catch {
        return undefined;
    }
}
async function credentialTypeHint(args, data, client, context) {
    const missing = data?.missing;
    if (!Array.isArray(missing) || !missing.includes('credential'))
        return undefined;
    const credentialId = await credentialIdFromResult(args, data, client);
    if (!credentialId)
        return undefined;
    if (context && !context.n8nApiKey)
        return undefined;
    const api = (0, handlers_n8n_manager_1.getN8nApiClient)(context);
    if (!api)
        return undefined;
    try {
        const credential = await api.getCredential(credentialId);
        const reason = agent_model_providers_1.AGENT_UNSUPPORTED_CREDENTIAL_TYPES[credential.type];
        if (!reason)
            return undefined;
        return `Credential ${credentialId} is type ${credential.type}, which n8n's agents runtime does not accept (${reason}). Use a credential of one of these types: ${agent_model_providers_1.AGENT_SUPPORTED_CREDENTIAL_TYPES.join(', ')}.`;
    }
    catch {
        return undefined;
    }
}
async function handleManageAgents(args, context) {
    const parsed = inputSchema.safeParse(args);
    if (!parsed.success) {
        return invalid(args?.action, parsed.error.issues.map(i => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '));
    }
    const { action, args: toolArgs, timeoutMs } = parsed.data;
    const client = (0, official_mcp_access_1.getOfficialMcpClient)(context);
    if (!client)
        return (0, official_mcp_access_1.notConfiguredResponse)(context, action);
    const spec = agents_action_map_1.AGENT_ACTION_MAP[action];
    try {
        const caps = await client.capabilities();
        if (!caps.reachable) {
            return (0, official_mcp_access_1.officialFailure)(new n8n_official_mcp_client_1.OfficialMcpError(caps.error ?? 'OFFICIAL_MCP_TRANSPORT_ERROR', 'n8n MCP server is not reachable'), action);
        }
        const tool = (0, agents_action_map_1.resolveOfficialTool)(spec, caps.toolNames);
        if (!tool) {
            return (0, official_mcp_access_1.officialFailure)(new n8n_official_mcp_client_1.OfficialMcpError('OFFICIAL_MCP_TOOL_UNAVAILABLE', `No tool for action "${action}" on this instance (looked for ${spec.tools.join(', ')})`), action);
        }
        if (action === 'reference') {
            return { success: true, action, officialTool: tool, data: await client.reference(tool) };
        }
        const result = await client.callTool(tool, toolArgs, { timeoutMs: timeoutMs ?? spec.defaultTimeoutMs, idempotent: spec.idempotent });
        const data = result.json ?? result.text;
        if (result.text.startsWith('Input validation error'))
            return invalid(action, result.text.slice(0, 2000));
        const officialCode = data?.ok === false ? data?.code : undefined;
        if (result.isError || officialCode) {
            const mapped = officialCode && OFFICIAL_CODE_MAP[officialCode];
            const response = {
                success: false,
                action,
                officialTool: tool,
                code: mapped?.code ?? 'OFFICIAL_MCP_ERROR',
                error: (0, official_mcp_access_1.officialErrorText)(data, officialCode),
                officialError: data,
            };
            const credHint = await credentialTypeHint(toolArgs, data, client, context);
            const hint = credHint ?? mapped?.hint;
            if (hint)
                response.hint = hint;
            return response;
        }
        const response = { success: true, action, officialTool: tool, data };
        if (result.truncated)
            response.truncated = true;
        const hint = await credentialTypeHint(toolArgs, data, client, context);
        if (hint)
            response.hint = hint;
        return response;
    }
    catch (err) {
        const failure = (0, official_mcp_access_1.officialFailure)(err, action);
        if (failure.code === 'OFFICIAL_MCP_TIMEOUT' && action === 'call') {
            failure.hint = n8n_official_mcp_client_1.OFFICIAL_MCP_HINTS.OFFICIAL_MCP_TIMEOUT + ' Each agent turn is one n8n execution; the executionId appears in n8n_executions once the turn finishes.';
        }
        logger_1.logger.warn('n8n_manage_agents failed', { action, code: failure.code });
        return failure;
    }
}
//# sourceMappingURL=handlers-agents.js.map