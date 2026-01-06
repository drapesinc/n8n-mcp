/**
 * Multi-workspace configuration for n8n MCP Server
 * Supports multiple n8n instances via environment variables
 *
 * Dynamically discovers workspaces from N8N_URL_* and N8N_TOKEN_* environment variables
 * Following the pattern from notion-mcp-server
 */

import { logger } from '../utils/logger';

export interface WorkspaceConfig {
  name: string;
  url: string;
  token: string;
  urlEnvVar: string;
  tokenEnvVar: string;
}

export interface MultiWorkspaceConfig {
  workspaces: Map<string, WorkspaceConfig>;
  defaultWorkspace: string | null;
}

/**
 * Load workspace configuration from environment variables
 *
 * Dynamically scans for N8N_URL_* and N8N_TOKEN_* env vars:
 * - N8N_URL_<NAME> and N8N_TOKEN_<NAME> → workspace "<name>" (lowercase)
 *
 * Also supports:
 * - N8N_API_URL + N8N_API_KEY (fallback for single-instance mode, creates "default" workspace)
 * - N8N_DEFAULT_WORKSPACE (sets the default, otherwise uses first found)
 */
export function loadWorkspaceConfig(): MultiWorkspaceConfig {
  const workspaces = new Map<string, WorkspaceConfig>();
  const urlPrefix = 'N8N_URL_';
  const tokenPrefix = 'N8N_TOKEN_';

  // Scan all environment variables for N8N_URL_* pattern
  for (const [envVar, value] of Object.entries(process.env)) {
    if (envVar.startsWith(urlPrefix) && value) {
      // Extract workspace name from env var (e.g., N8N_URL_PERSONAL → personal)
      const workspaceName = envVar.substring(urlPrefix.length).toLowerCase();

      // Find corresponding token
      const tokenEnvVar = `${tokenPrefix}${envVar.substring(urlPrefix.length)}`;
      const token = process.env[tokenEnvVar];

      // Skip if no workspace name or no token
      if (!workspaceName || !token) {
        if (!token) {
          logger.warn(`Workspace '${workspaceName}' has URL but missing token (${tokenEnvVar}), skipping`);
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

  // Fallback: if no workspace-specific configs, use N8N_API_URL/N8N_API_KEY as 'default'
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

  // Determine default workspace
  let defaultWorkspace: string | null = null;
  const envDefault = process.env.N8N_DEFAULT_WORKSPACE?.toLowerCase();

  if (envDefault && workspaces.has(envDefault)) {
    defaultWorkspace = envDefault;
  } else if (workspaces.size > 0) {
    // Use first available workspace as default
    defaultWorkspace = workspaces.keys().next().value ?? null;
  }

  return { workspaces, defaultWorkspace };
}

/**
 * Get a workspace configuration by name
 * Returns null if workspace not found
 */
export function getWorkspace(config: MultiWorkspaceConfig, name?: string): WorkspaceConfig | null {
  const workspaceName = name?.toLowerCase() || config.defaultWorkspace;
  if (!workspaceName) return null;
  return config.workspaces.get(workspaceName) || null;
}

/**
 * Check if multi-workspace mode is enabled (more than one workspace configured)
 */
export function isMultiWorkspaceMode(config: MultiWorkspaceConfig): boolean {
  return config.workspaces.size > 1;
}

/**
 * Get list of available workspace names
 */
export function getAvailableWorkspaces(config: MultiWorkspaceConfig): string[] {
  return Array.from(config.workspaces.keys());
}

/**
 * Convert workspace config to InstanceContext for use with existing handlers
 */
export function workspaceToInstanceContext(workspace: WorkspaceConfig): {
  n8nApiUrl: string;
  n8nApiKey: string;
  instanceId: string;
} {
  return {
    n8nApiUrl: workspace.url,
    n8nApiKey: workspace.token,
    instanceId: `workspace-${workspace.name}`,
  };
}

/**
 * Describe the current workspace configuration (for logging)
 */
export function describeWorkspaceConfig(config: MultiWorkspaceConfig): string {
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

// Singleton instance - load config once at startup
let configInstance: MultiWorkspaceConfig | null = null;

/**
 * Get the workspace configuration singleton
 */
export function getWorkspaceConfig(): MultiWorkspaceConfig {
  if (!configInstance) {
    configInstance = loadWorkspaceConfig();
    logger.info(describeWorkspaceConfig(configInstance));
  }
  return configInstance;
}

/**
 * Reset the config singleton (for testing)
 */
export function resetWorkspaceConfig(): void {
  configInstance = null;
}
