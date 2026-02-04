"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkspaceApiClientManager = getWorkspaceApiClientManager;
exports.resetWorkspaceApiClientManager = resetWorkspaceApiClientManager;
exports.resolveWorkspaceContext = resolveWorkspaceContext;
exports.shouldShowWorkspaceParam = shouldShowWorkspaceParam;
exports.getWorkspaceParamSchema = getWorkspaceParamSchema;
const n8n_api_client_1 = require("./n8n-api-client");
const workspace_config_1 = require("../config/workspace-config");
const logger_1 = require("../utils/logger");
class WorkspaceApiClientManager {
    constructor() {
        this.clients = new Map();
        this.workspaceConfig = (0, workspace_config_1.getWorkspaceConfig)();
    }
    getOrCreateClient(workspace) {
        let client = this.clients.get(workspace.name);
        if (!client) {
            client = new n8n_api_client_1.N8nApiClient({
                baseUrl: workspace.url,
                apiKey: workspace.token,
            });
            this.clients.set(workspace.name, client);
            logger_1.logger.debug(`Created API client for workspace '${workspace.name}'`);
        }
        return client;
    }
    getClient(workspaceName) {
        const workspace = (0, workspace_config_1.getWorkspace)(this.workspaceConfig, workspaceName);
        if (!workspace)
            return null;
        return this.getOrCreateClient(workspace);
    }
    getInstanceContext(workspaceName) {
        const workspace = (0, workspace_config_1.getWorkspace)(this.workspaceConfig, workspaceName);
        if (!workspace)
            return null;
        return (0, workspace_config_1.workspaceToInstanceContext)(workspace);
    }
    isMultiWorkspace() {
        return (0, workspace_config_1.isMultiWorkspaceMode)(this.workspaceConfig);
    }
    getAvailableWorkspaces() {
        return (0, workspace_config_1.getAvailableWorkspaces)(this.workspaceConfig);
    }
    getDefaultWorkspace() {
        return this.workspaceConfig.defaultWorkspace;
    }
    getWorkspaceConfig(workspaceName) {
        return (0, workspace_config_1.getWorkspace)(this.workspaceConfig, workspaceName);
    }
    getWorkspaceNotFoundError(workspaceName) {
        const available = this.getAvailableWorkspaces();
        if (workspaceName) {
            return `Workspace '${workspaceName}' not found. Available workspaces: ${available.join(', ') || 'none'}`;
        }
        return `No n8n workspace configured. Set N8N_URL_* and N8N_TOKEN_* env vars, or N8N_API_URL and N8N_API_KEY for single-instance mode.`;
    }
}
let manager = null;
function getWorkspaceApiClientManager() {
    if (!manager) {
        manager = new WorkspaceApiClientManager();
    }
    return manager;
}
function resetWorkspaceApiClientManager() {
    manager = null;
}
function resolveWorkspaceContext(workspaceName) {
    return getWorkspaceApiClientManager().getInstanceContext(workspaceName);
}
function shouldShowWorkspaceParam() {
    return getWorkspaceApiClientManager().isMultiWorkspace();
}
function getWorkspaceParamSchema() {
    const manager = getWorkspaceApiClientManager();
    if (!manager.isMultiWorkspace()) {
        return null;
    }
    const workspaces = manager.getAvailableWorkspaces();
    const defaultWs = manager.getDefaultWorkspace();
    return {
        type: 'string',
        description: `Workspace to use. Available: ${workspaces.join(', ')}${defaultWs ? `. Default: ${defaultWs}` : ''}`,
        enum: workspaces,
    };
}
//# sourceMappingURL=workspace-api-client.js.map