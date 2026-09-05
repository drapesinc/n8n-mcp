"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OFFICIAL_TOOL_MIN_VERSION = void 0;
exports.callOfficialTool = callOfficialTool;
exports.handleExploreNodeResources = handleExploreNodeResources;
exports.handleListCatalog = handleListCatalog;
exports.resolveProjectChoices = resolveProjectChoices;
const zod_1 = require("zod");
const official_mcp_access_1 = require("./official-mcp-access");
const n8n_official_mcp_client_1 = require("../services/n8n-official-mcp-client");
const agents_action_map_1 = require("./agents-action-map");
const logger_1 = require("../utils/logger");
const handlers_n8n_manager_1 = require("./handlers-n8n-manager");
const mcp_exposure_1 = require("../services/mcp-exposure");
const n8n_errors_1 = require("../utils/n8n-errors");
const exploreSchema = zod_1.z.object({
    nodeType: zod_1.z.string().min(1),
    version: zod_1.z.number(),
    methodName: zod_1.z.string().min(1),
    methodType: zod_1.z.enum(['listSearch', 'loadOptions']),
    credentialType: zod_1.z.string().min(1),
    credentialId: zod_1.z.string().min(1),
    filter: zod_1.z.string().optional(),
    paginationToken: zod_1.z.string().optional(),
    currentNodeParameters: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    timeoutMs: zod_1.z.number().int().min(agents_action_map_1.MIN_TIMEOUT_MS).max(agents_action_map_1.MAX_TIMEOUT_MS).optional(),
}).strict();
const EXPLORE_TOOLS = ['explore_node_resources'];
exports.OFFICIAL_TOOL_MIN_VERSION = {
    get_workflow_versions_diff: '2.36',
    get_workflow_history: '2.34',
    get_workflow_version: '2.34',
    restore_workflow_version: '2.34',
    prepare_workflow_pin_data: '2.34',
    test_workflow: '2.34',
    execute_workflow: '2.34',
    add_data_table_column: '2.34',
    delete_data_table_column: '2.34',
    rename_data_table_column: '2.34',
    explore_node_resources: '2.34',
    search_projects: '2.34',
};
const DEFAULT_MIN_VERSION = '2.34';
async function callOfficialTool(context, toolAliases, args, timeoutMs, label, idempotent) {
    const client = (0, official_mcp_access_1.getOfficialMcpClient)(context);
    if (!client)
        return (0, official_mcp_access_1.notConfiguredResponse)(context, label);
    try {
        const caps = await client.capabilities();
        if (!caps.reachable)
            return (0, official_mcp_access_1.officialFailure)(new n8n_official_mcp_client_1.OfficialMcpError(caps.error ?? 'OFFICIAL_MCP_TRANSPORT_ERROR', 'n8n MCP server is not reachable'), label);
        const tool = toolAliases.find(t => caps.toolNames.includes(t));
        if (!tool) {
            const minVersion = exports.OFFICIAL_TOOL_MIN_VERSION[toolAliases[0]] ?? DEFAULT_MIN_VERSION;
            return (0, official_mcp_access_1.officialFailure)(new n8n_official_mcp_client_1.OfficialMcpError('OFFICIAL_MCP_TOOL_UNAVAILABLE', `This instance does not expose ${toolAliases.join(' / ')} (needs n8n >= ${minVersion})`), label);
        }
        const result = await client.callTool(tool, args, { timeoutMs, idempotent });
        const data = result.json ?? result.text;
        if (result.text.startsWith('Input validation error'))
            return { success: false, action: label, code: 'INVALID_ARGS', error: result.text.slice(0, 2000) };
        const root = data;
        const executeDispatchFailed = tool === 'execute_workflow' && root?.status === 'error';
        const isFailure = result.isError ||
            root?.ok === false ||
            root?.success === false ||
            executeDispatchFailed;
        if (isFailure) {
            const hasText = typeof root?.message === 'string' || typeof root?.error === 'string';
            const error = executeDispatchFailed && !hasText
                ? 'execute_workflow reported status "error" without an error message'
                : (0, official_mcp_access_1.officialErrorText)(data, undefined);
            return { success: false, action: label, officialTool: tool, code: 'OFFICIAL_MCP_ERROR', error, officialError: data };
        }
        return { success: true, action: label, officialTool: tool, data, ...(result.truncated ? { truncated: true } : {}) };
    }
    catch (err) {
        const failure = (0, official_mcp_access_1.officialFailure)(err, label);
        logger_1.logger.warn(`${label} failed`, { code: failure.code });
        return failure;
    }
}
async function handleExploreNodeResources(args, context) {
    const parsed = exploreSchema.safeParse(args);
    if (!parsed.success) {
        return { success: false, action: 'explore_node_resources', code: 'INVALID_ARGS', error: parsed.error.issues.map(i => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ') };
    }
    const { timeoutMs, ...forwarded } = parsed.data;
    return callOfficialTool(context, EXPLORE_TOOLS, forwarded, timeoutMs ?? agents_action_map_1.DEFAULT_TIMEOUT_MS, 'explore_node_resources', true);
}
const CATALOG_TOOLS = ['search_projects'];
const catalogSchema = zod_1.z.object({
    kind: zod_1.z.enum(['projects', 'tags']),
    query: zod_1.z.string().optional(),
    limit: zod_1.z.number().int().min(1).max(500).optional(),
}).strict();
function filterItems(items, query, limit) {
    const q = query?.trim().toLowerCase();
    const filtered = q ? items.filter(i => i.name.toLowerCase().includes(q)) : items;
    return limit ? filtered.slice(0, limit) : filtered;
}
async function handleListCatalog(args, context) {
    const parsed = catalogSchema.safeParse(args);
    if (!parsed.success) {
        return { success: false, code: 'INVALID_ARGS', error: parsed.error.issues.map(i => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ') };
    }
    const { kind, query, limit } = parsed.data;
    const api = (0, handlers_n8n_manager_1.getN8nApiClient)(context);
    if (!api)
        return { success: false, code: 'NOT_CONFIGURED', error: 'n8n API not configured. Set N8N_API_URL and N8N_API_KEY.' };
    if (kind === 'tags') {
        try {
            const tags = (await api.listTags({ limit: 250 })).data.map(t => ({ id: String(t.id), name: t.name }));
            return { success: true, kind, backend: 'public-api', data: { items: filterItems(tags, query, limit) } };
        }
        catch (err) {
            return { success: false, kind, code: 'API_ERROR', error: err instanceof Error ? err.message : String(err) };
        }
    }
    const resolved = await resolveProjectChoices(context);
    if ('failure' in resolved)
        return { ...resolved.failure, kind };
    const { backend, teamProjectsEnabled, items } = resolved.choices;
    return {
        success: true,
        kind,
        backend,
        data: { teamProjectsEnabled, items: filterItems(items, query, limit) },
    };
}
async function resolveProjectChoices(context) {
    const contextMatches = (0, mcp_exposure_1.publicApiMatchesContext)(context);
    const api = contextMatches ? (0, handlers_n8n_manager_1.getN8nApiClient)(context) : null;
    if (contextMatches) {
        if (!api) {
            return { failure: { success: false, code: 'NOT_CONFIGURED', error: 'n8n API not configured. Set N8N_API_URL and N8N_API_KEY.' } };
        }
        try {
            const projects = (await api.listProjects()).map(p => ({ id: p.id, name: p.name, type: p.type, personal: p.type === 'personal' }));
            return { choices: { backend: 'public-api', teamProjectsEnabled: true, items: projects } };
        }
        catch (err) {
            const status = err instanceof n8n_errors_1.N8nApiError ? err.statusCode : undefined;
            if (status !== 403 && status !== 404) {
                return { failure: { success: false, code: 'API_ERROR', error: err instanceof Error ? err.message : String(err) } };
            }
        }
    }
    if ((0, official_mcp_access_1.getOfficialMcpClient)(context)) {
        const official = await callOfficialTool(context, CATALOG_TOOLS, {}, agents_action_map_1.DEFAULT_TIMEOUT_MS, 'list_catalog', true);
        if (!official.success)
            return { failure: { ...official, backend: 'official-mcp' } };
        const officialData = official.data;
        const raw = (officialData?.data ?? []);
        const items = raw.map(p => ({ id: String(p.id), name: String(p.name), type: p.type, personal: p.type === 'personal' }));
        const teamProjectsEnabled = typeof officialData?.teamProjectsEnabled === 'boolean'
            ? officialData.teamProjectsEnabled
            : items.some(p => !p.personal);
        return { choices: { backend: 'official-mcp', teamProjectsEnabled, items } };
    }
    if (!api) {
        return { failure: { success: false, code: 'NOT_CONFIGURED', backend: 'official-mcp', error: mcp_exposure_1.PUBLIC_API_CONTEXT_HINT } };
    }
    try {
        const personalId = await api.resolvePersonalProjectId();
        return {
            choices: {
                backend: 'public-api',
                teamProjectsEnabled: false,
                items: [{ id: personalId, name: 'Personal', type: 'personal', personal: true }],
            },
        };
    }
    catch (err) {
        return {
            failure: {
                success: false,
                backend: 'public-api',
                code: 'API_ERROR',
                error: err instanceof Error ? err.message : String(err),
                hint: 'Team projects are not available through the Public API on this instance and the personal project could not be resolved. Pass projectId explicitly, or configure N8N_MCP_ACCESS_TOKEN so projects can be listed through n8n\'s MCP server.',
            },
        };
    }
}
//# sourceMappingURL=handlers-official-tools.js.map