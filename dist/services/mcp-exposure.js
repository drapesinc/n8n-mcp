"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLIC_API_CONTEXT_HINT = exports.WORKFLOW_NOT_EXPOSED_HINT = exports.NOT_EXPOSED_PREFIX = void 0;
exports.publicApiMatchesContext = publicApiMatchesContext;
exports.isNotExposedResponse = isNotExposedResponse;
exports.enableWorkflowMcpExposure = enableWorkflowMcpExposure;
exports.withMcpExposure = withMcpExposure;
const tool_policy_1 = require("../mcp/tool-policy");
const logger_1 = require("../utils/logger");
exports.NOT_EXPOSED_PREFIX = 'Workflow is not available in MCP';
exports.WORKFLOW_NOT_EXPOSED_HINT = 'This workflow is not exposed to n8n\'s MCP server ("Available in MCP" in workflow settings). ' +
    'Re-run with exposeToMcp: true to enable it — this is a visible, persistent setting on the workflow; ' +
    'confirm with the user first.';
exports.PUBLIC_API_CONTEXT_HINT = 'This request names an n8n instance (x-n8n-url) without its Public API key (x-n8n-key). ' +
    'Enabling "Available in MCP", the pinned/direct trigger lookup and the HTTP trigger path ' +
    'all need the Public API credentials of the same instance — add x-n8n-key alongside x-n8n-url.';
function publicApiMatchesContext(context) {
    const hasUrl = typeof context?.n8nApiUrl === 'string' && context.n8nApiUrl.length > 0;
    const hasKey = typeof context?.n8nApiKey === 'string' && context.n8nApiKey.length > 0;
    return !(hasUrl && !hasKey);
}
const CONSENT_WRITE_TOOL = 'n8n_update_partial_workflow';
const EXPOSE_OPERATION = 'expose';
function errorTexts(value) {
    if (typeof value === 'string')
        return [value];
    if (value && typeof value === 'object') {
        const record = value;
        return [record.error, record.message].filter((text) => typeof text === 'string');
    }
    return [];
}
function isNotExposedResponse(response) {
    if (response.success !== false)
        return false;
    const candidates = [
        ...errorTexts(response.officialError),
        ...(typeof response.error === 'string' ? [response.error] : []),
    ];
    return candidates.some(text => text.trimStart().startsWith(exports.NOT_EXPOSED_PREFIX));
}
async function enableWorkflowMcpExposure(apiClient, workflowId) {
    const warnings = [];
    const current = await apiClient.getWorkflow(workflowId);
    const settings = {
        ...(current.settings ?? {}),
        availableInMCP: true,
    };
    await apiClient.updateWorkflow(workflowId, { ...current, settings }, { onWarning: message => warnings.push(message) });
    logger_1.logger.info('Enabled MCP exposure for workflow', { workflowId });
    return { warnings };
}
function consentWriteRefusal(toolName) {
    if ((0, tool_policy_1.getDisabledTools)().has(CONSENT_WRITE_TOOL)) {
        return `enabling it is a workflow update and '${CONSENT_WRITE_TOOL}' is disabled by server policy`;
    }
    if ((0, tool_policy_1.isOperationDisabled)(toolName, EXPOSE_OPERATION)) {
        return `the '${EXPOSE_OPERATION}' operation of '${toolName}' is disabled by server policy`;
    }
    return null;
}
function notExposedFailure(opts, response) {
    return {
        success: false,
        action: opts.action,
        code: 'WORKFLOW_NOT_EXPOSED',
        error: 'n8n\'s MCP server refused this workflow: it is not available in MCP',
        hint: exports.WORKFLOW_NOT_EXPOSED_HINT,
        officialError: response.officialError,
    };
}
async function withMcpExposure(opts, call) {
    const first = await call();
    if (!isNotExposedResponse(first))
        return first;
    if (opts.exposeToMcp !== true)
        return notExposedFailure(opts, first);
    if (!publicApiMatchesContext(opts.context)) {
        return {
            success: false,
            action: opts.action,
            code: 'NOT_CONFIGURED',
            error: exports.PUBLIC_API_CONTEXT_HINT,
        };
    }
    const refusal = consentWriteRefusal(opts.toolName);
    if (refusal) {
        return {
            success: false,
            action: opts.action,
            code: 'OPERATION_DISABLED',
            error: `Cannot enable "Available in MCP" on workflow ${opts.workflowId}: ${refusal}.`,
            hint: 'Enable the workflow\'s "Available in MCP" setting in the n8n UI, then re-run without exposeToMcp.',
        };
    }
    if (!opts.apiClient) {
        return {
            success: false,
            action: opts.action,
            code: 'NOT_CONFIGURED',
            error: 'Enabling MCP exposure needs the n8n Public API (N8N_API_URL and N8N_API_KEY)',
        };
    }
    let warnings;
    try {
        ({ warnings } = await enableWorkflowMcpExposure(opts.apiClient, opts.workflowId));
    }
    catch (err) {
        return {
            success: false,
            action: opts.action,
            code: 'EXPOSE_FAILED',
            error: `Could not enable "Available in MCP" on workflow ${opts.workflowId}: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
    const second = await call();
    const merged = [...warnings, ...(second.warnings ?? [])];
    const extra = {
        exposedToMcp: true,
        ...(merged.length > 0 ? { warnings: merged } : {}),
    };
    if (isNotExposedResponse(second)) {
        return {
            ...notExposedFailure(opts, second),
            ...extra,
            hint: 'The setting was written, but n8n still refused the workflow. Check the workflow in the n8n UI (workflow settings → Available in MCP) and the instance-level MCP access list.',
        };
    }
    return { ...second, ...extra };
}
//# sourceMappingURL=mcp-exposure.js.map