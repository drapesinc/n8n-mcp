"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveGetNodeAliases = resolveGetNodeAliases;
exports.suggestExecutionsAction = suggestExecutionsAction;
exports.withWorkflowIdAlias = withWorkflowIdAlias;
exports.hasText = hasText;
const logger_1 = require("../utils/logger");
const GET_NODE_MODE_ALIASES = {
    essentials: { mode: 'info', detail: 'standard' },
    minimal: { mode: 'info', detail: 'minimal' },
    standard: { mode: 'info', detail: 'standard' },
    full: { mode: 'info', detail: 'full' },
    operations: { mode: 'info', detail: 'standard' },
    properties: { mode: 'search_properties' },
    search: { mode: 'search_properties' },
};
const GET_NODE_DETAIL_ALIASES = {
    essentials: 'standard',
    summary: 'minimal',
    short: 'minimal',
};
function resolveGetNodeAliases(mode, detail) {
    const aliased = [];
    let resolvedMode = mode;
    let resolvedDetail = detail;
    if (typeof resolvedDetail === 'string') {
        const detailAlias = GET_NODE_DETAIL_ALIASES[resolvedDetail.toLowerCase()];
        if (detailAlias) {
            aliased.push(`detail=${resolvedDetail}→${detailAlias}`);
            resolvedDetail = detailAlias;
        }
    }
    if (typeof resolvedMode === 'string') {
        const modeAlias = GET_NODE_MODE_ALIASES[resolvedMode.toLowerCase()];
        if (modeAlias) {
            const target = modeAlias.detail
                ? `mode=${modeAlias.mode}, detail=${modeAlias.detail}`
                : `mode=${modeAlias.mode}`;
            aliased.push(`mode=${resolvedMode}→${target}`);
            resolvedMode = modeAlias.mode;
            if (modeAlias.detail)
                resolvedDetail = modeAlias.detail;
        }
    }
    if (aliased.length > 0) {
        logger_1.logger.debug(`get_node: retired parameter vocabulary aliased (${aliased.join('; ')})`);
    }
    return { mode: resolvedMode, detail: resolvedDetail };
}
const EXECUTIONS_ACTION_HINTS = {
    get_many: "Did you mean action='list'?",
    getmany: "Did you mean action='list'?",
    getall: "Did you mean action='list'?",
    get_all: "Did you mean action='list'?",
    list_executions: "Did you mean action='list'?",
    listexecutions: "Did you mean action='list'?",
    search: "Did you mean action='list'?",
    get_execution: "Did you mean action='get'?",
    getexecution: "Did you mean action='get'?",
    retry: "Retrying an execution is not supported; re-run the workflow with n8n_test_workflow.",
    list_runs: 'Evaluation test runs are managed by n8n_evaluations.',
    get_run: 'Evaluation test runs are managed by n8n_evaluations.',
    getrows: 'Data table rows are managed by n8n_manage_datatable.',
    get_rows: 'Data table rows are managed by n8n_manage_datatable.',
};
function suggestExecutionsAction(action) {
    return EXECUTIONS_ACTION_HINTS[action.toLowerCase()];
}
function withWorkflowIdAlias(args) {
    const workflowIdMissing = args.workflowId === undefined || args.workflowId === null
        || (typeof args.workflowId === 'string' && args.workflowId.trim() === '');
    if (!workflowIdMissing) {
        return args;
    }
    const id = typeof args.id === 'number' ? String(args.id) : args.id;
    if (typeof id !== 'string' || id.trim() === '') {
        return typeof args.workflowId === 'string' ? { ...args, workflowId: undefined } : args;
    }
    return { ...args, workflowId: id };
}
function hasText(value) {
    return typeof value === 'string' && value.trim() !== '';
}
//# sourceMappingURL=param-aliases.js.map