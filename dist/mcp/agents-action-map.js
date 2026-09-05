"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DESTRUCTIVE_AGENT_ACTIONS = exports.AGENT_ACTIONS = exports.AGENT_ACTION_MAP = exports.PINNED_TIMEOUT_MS = exports.MAX_TIMEOUT_MS = exports.MIN_TIMEOUT_MS = exports.CALL_TIMEOUT_MS = exports.DEFAULT_TIMEOUT_MS = void 0;
exports.resolveOfficialTool = resolveOfficialTool;
exports.DEFAULT_TIMEOUT_MS = 30000;
exports.CALL_TIMEOUT_MS = 180000;
exports.MIN_TIMEOUT_MS = 5000;
exports.MAX_TIMEOUT_MS = 600000;
exports.PINNED_TIMEOUT_MS = 300000;
exports.AGENT_ACTION_MAP = {
    reference: { tools: ['get_agent_builder_reference'], defaultTimeoutMs: exports.DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
    search: { tools: ['search_agents'], defaultTimeoutMs: exports.DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
    get: { tools: ['get_agent'], defaultTimeoutMs: exports.DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
    create: { tools: ['create_agent'], defaultTimeoutMs: exports.DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
    mutate: { tools: ['mutate_agent'], defaultTimeoutMs: exports.DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
    validate: { tools: ['validate_agent'], defaultTimeoutMs: exports.DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
    call: { tools: ['call_agent'], defaultTimeoutMs: exports.CALL_TIMEOUT_MS, destructive: true, idempotent: false },
    publish: { tools: ['publish_agent'], defaultTimeoutMs: exports.DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
    unpublish: { tools: ['unpublish_agent'], defaultTimeoutMs: exports.DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
    revert: { tools: ['revert_agent'], defaultTimeoutMs: exports.DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
    versions: { tools: ['list_agent_versions'], defaultTimeoutMs: exports.DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
    delete: { tools: ['delete_agent'], defaultTimeoutMs: exports.DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
    discover_assets: { tools: ['discover_agent_assets'], defaultTimeoutMs: exports.DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
    verify_mcp_server: { tools: ['verify_agent_mcp_server'], defaultTimeoutMs: exports.DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
    update_integration: { tools: ['update_agent_integration'], defaultTimeoutMs: exports.DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
};
exports.AGENT_ACTIONS = Object.keys(exports.AGENT_ACTION_MAP);
exports.DESTRUCTIVE_AGENT_ACTIONS = exports.AGENT_ACTIONS.filter(a => exports.AGENT_ACTION_MAP[a].destructive);
function resolveOfficialTool(spec, available) {
    return spec.tools.find(t => available.includes(t)) ?? null;
}
//# sourceMappingURL=agents-action-map.js.map