"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadWorkspaceConfig = loadWorkspaceConfig;
exports.getWorkspace = getWorkspace;
exports.isMultiWorkspaceMode = isMultiWorkspaceMode;
exports.getAvailableWorkspaces = getAvailableWorkspaces;
exports.workspaceToInstanceContext = workspaceToInstanceContext;
exports.describeWorkspaceConfig = describeWorkspaceConfig;
exports.getWorkspaceConfig = getWorkspaceConfig;
exports.resetWorkspaceConfig = resetWorkspaceConfig;
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("../utils/logger");
dotenv_1.default.config();
function loadWorkspaceConfig() {
    const workspaces = new Map();
    const urlPrefix = 'N8N_URL_';
    const tokenPrefix = 'N8N_TOKEN_';
    for (const [envVar, value] of Object.entries(process.env)) {
        if (envVar.startsWith(urlPrefix) && value) {
            const workspaceName = envVar.substring(urlPrefix.length).toLowerCase();
            const tokenEnvVar = `${tokenPrefix}${envVar.substring(urlPrefix.length)}`;
            const token = process.env[tokenEnvVar];
            if (!workspaceName || !token) {
                if (!token) {
                    logger_1.logger.warn(`Workspace '${workspaceName}' has URL but missing token (${tokenEnvVar}), skipping`);
                }
                continue;
            }
            workspaces.set(workspaceName, {
                name: workspaceName,
                url: value,
                token,
                urlEnvVar: envVar,
                tokenEnvVar,
            });
        }
    }
    if (workspaces.size === 0) {
        const fallbackUrl = process.env.N8N_API_URL;
        const fallbackKey = process.env.N8N_API_KEY;
        if (fallbackUrl && fallbackKey) {
            workspaces.set('default', {
                name: 'default',
                url: fallbackUrl,
                token: fallbackKey,
                urlEnvVar: 'N8N_API_URL',
                tokenEnvVar: 'N8N_API_KEY',
            });
        }
    }
    let defaultWorkspace = null;
    const envDefault = process.env.N8N_DEFAULT_WORKSPACE?.toLowerCase();
    if (envDefault && workspaces.has(envDefault)) {
        defaultWorkspace = envDefault;
    }
    else if (workspaces.size > 0) {
        defaultWorkspace = workspaces.keys().next().value ?? null;
    }
    return { workspaces, defaultWorkspace };
}
function getWorkspace(config, name) {
    const workspaceName = name?.toLowerCase() || config.defaultWorkspace;
    if (!workspaceName)
        return null;
    return config.workspaces.get(workspaceName) || null;
}
function isMultiWorkspaceMode(config) {
    return config.workspaces.size > 1;
}
function getAvailableWorkspaces(config) {
    return Array.from(config.workspaces.keys());
}
function workspaceToInstanceContext(workspace) {
    return {
        n8nApiUrl: workspace.url,
        n8nApiKey: workspace.token,
        instanceId: `workspace-${workspace.name}`,
    };
}
function describeWorkspaceConfig(config) {
    const workspaceList = Array.from(config.workspaces.keys());
    if (workspaceList.length === 0) {
        return 'Workspace config: No workspaces configured (missing N8N_URL_* + N8N_TOKEN_* or N8N_API_URL + N8N_API_KEY env vars)';
    }
    if (workspaceList.length === 1 && workspaceList[0] === 'default') {
        return 'Workspace config: Single workspace mode (using N8N_API_URL + N8N_API_KEY)';
    }
    return `Workspace config: Multi-workspace mode\n` +
        `  Available: ${workspaceList.join(', ')}\n` +
        `  Default: ${config.defaultWorkspace || 'none'}`;
}
let configInstance = null;
function getWorkspaceConfig() {
    if (!configInstance) {
        configInstance = loadWorkspaceConfig();
        logger_1.logger.info(describeWorkspaceConfig(configInstance));
    }
    return configInstance;
}
function resetWorkspaceConfig() {
    configInstance = null;
}
//# sourceMappingURL=workspace-config.js.map