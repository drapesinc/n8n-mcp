"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDisabledTools = getDisabledTools;
exports.isToolDisabled = isToolDisabled;
exports.getValidOperations = getValidOperations;
exports.getDisabledToolOperations = getDisabledToolOperations;
exports.getDisabledOperations = getDisabledOperations;
exports.resolveRequestedOperation = resolveRequestedOperation;
exports.isOperationDisabled = isOperationDisabled;
exports.resetToolPolicyCache = resetToolPolicyCache;
const logger_1 = require("../utils/logger");
const tools_n8n_manager_1 = require("./tools-n8n-manager");
const MAX_ENV_LENGTH = 10000;
const MAX_DISABLED_TOOLS = 200;
const MAX_OPERATION_ENTRIES = 50;
let disabledToolsCache = null;
let disabledOperationsCache = null;
function getDisabledTools() {
    const env = process.env.DISABLED_TOOLS || '';
    if (disabledToolsCache?.env === env)
        return disabledToolsCache.value;
    if (!env) {
        disabledToolsCache = { env, value: new Set() };
        return disabledToolsCache.value;
    }
    let raw = env;
    if (raw.length > MAX_ENV_LENGTH) {
        logger_1.logger.warn(`DISABLED_TOOLS environment variable too long (${raw.length} chars), truncating to ${MAX_ENV_LENGTH}`);
        raw = raw.substring(0, MAX_ENV_LENGTH);
    }
    let tools = raw
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
    if (tools.length > MAX_DISABLED_TOOLS) {
        logger_1.logger.warn(`DISABLED_TOOLS contains ${tools.length} tools, limiting to first ${MAX_DISABLED_TOOLS}`);
        tools = tools.slice(0, MAX_DISABLED_TOOLS);
    }
    if (tools.length > 0) {
        logger_1.logger.info(`Disabled tools configured: ${tools.join(', ')}`);
    }
    disabledToolsCache = { env, value: new Set(tools) };
    return disabledToolsCache.value;
}
function isToolDisabled(toolName) {
    return getDisabledTools().has(toolName);
}
function getValidOperations(toolName) {
    const paramName = tools_n8n_manager_1.TOOL_OPERATION_PARAM[toolName];
    const valid = new Set();
    if (!paramName)
        return valid;
    const tool = tools_n8n_manager_1.n8nManagementTools.find(t => t.name === toolName);
    const enumValues = tool?.inputSchema?.properties?.[paramName]?.enum ?? [];
    for (const value of enumValues)
        valid.add(String(value).toLowerCase());
    for (const value of tools_n8n_manager_1.DESTRUCTIVE_TOOL_OPERATIONS[toolName] ?? [])
        valid.add(value.toLowerCase());
    return valid;
}
function getDisabledToolOperations() {
    const env = process.env.DISABLED_TOOL_OPERATIONS || '';
    if (disabledOperationsCache?.env === env)
        return disabledOperationsCache.value;
    const result = new Map();
    if (!env) {
        disabledOperationsCache = { env, value: result };
        return result;
    }
    let raw = env;
    if (raw.length > MAX_ENV_LENGTH) {
        logger_1.logger.warn(`DISABLED_TOOL_OPERATIONS environment variable too long (${raw.length} chars), truncating to ${MAX_ENV_LENGTH}`);
        raw = raw.substring(0, MAX_ENV_LENGTH);
    }
    let entries = raw.split(';').map(e => e.trim()).filter(Boolean);
    if (entries.length > MAX_OPERATION_ENTRIES) {
        logger_1.logger.warn(`DISABLED_TOOL_OPERATIONS contains ${entries.length} entries, limiting to first ${MAX_OPERATION_ENTRIES}`);
        entries = entries.slice(0, MAX_OPERATION_ENTRIES);
    }
    for (const entry of entries) {
        const colonIdx = entry.indexOf(':');
        if (colonIdx === -1)
            continue;
        const toolName = entry.substring(0, colonIdx).trim();
        const opsStr = entry.substring(colonIdx + 1).trim();
        if (!toolName || !opsStr)
            continue;
        const ops = opsStr.split(',').map(o => o.trim().toLowerCase()).filter(Boolean);
        if (ops.length === 0)
            continue;
        const existing = result.get(toolName) ?? new Set();
        ops.forEach(op => existing.add(op));
        result.set(toolName, existing);
    }
    for (const [toolName, ops] of result) {
        if (!tools_n8n_manager_1.TOOL_OPERATION_PARAM[toolName]) {
            logger_1.logger.warn(`DISABLED_TOOL_OPERATIONS: unknown tool '${toolName}' — no per-operation filtering applied. Eligible tools: ${Object.keys(tools_n8n_manager_1.TOOL_OPERATION_PARAM).join(', ')}`);
            continue;
        }
        const paramName = tools_n8n_manager_1.TOOL_OPERATION_PARAM[toolName];
        const validOps = getValidOperations(toolName);
        for (const op of ops) {
            if (validOps.size > 0 && !validOps.has(op)) {
                logger_1.logger.warn(`DISABLED_TOOL_OPERATIONS: '${op}' is not a valid ${paramName} for '${toolName}' (valid: ${[...validOps].join(', ')}); it will have no effect.`);
            }
        }
    }
    if (result.size > 0) {
        const summary = [...result.entries()]
            .map(([t, ops]) => `${t}: [${[...ops].join(', ')}]`)
            .join('; ');
        logger_1.logger.info(`Disabled tool operations configured: ${summary}`);
    }
    disabledOperationsCache = { env, value: result };
    return result;
}
function getDisabledOperations(toolName) {
    return getDisabledToolOperations().get(toolName) ?? new Set();
}
function resolveRequestedOperation(toolName, args) {
    const paramName = tools_n8n_manager_1.TOOL_OPERATION_PARAM[toolName];
    if (!paramName)
        return undefined;
    const raw = args?.[paramName];
    if (raw === undefined || raw === null)
        return tools_n8n_manager_1.TOOL_OPERATION_DEFAULT[toolName];
    if (typeof raw === 'string' && raw.trim() === '')
        return tools_n8n_manager_1.TOOL_OPERATION_DEFAULT[toolName];
    return raw;
}
function isOperationDisabled(toolName, operation) {
    return getDisabledOperations(toolName).has(String(operation).toLowerCase());
}
function resetToolPolicyCache() {
    disabledToolsCache = null;
    disabledOperationsCache = null;
}
//# sourceMappingURL=tool-policy.js.map