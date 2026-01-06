/**
 * Workspace API Client Manager
 *
 * Manages multiple N8nApiClient instances, one per workspace.
 * Integrates with the existing InstanceContext-based handler system.
 */

import { N8nApiClient } from './n8n-api-client';
import {
  getWorkspaceConfig,
  getWorkspace,
  isMultiWorkspaceMode,
  getAvailableWorkspaces,
  workspaceToInstanceContext,
  type MultiWorkspaceConfig,
  type WorkspaceConfig,
} from '../config/workspace-config';
import { InstanceContext } from '../types/instance-context';
import { logger } from '../utils/logger';

/**
 * Workspace API Client Manager
 *
 * Singleton that manages API clients for all configured workspaces.
 * Creates clients lazily on first access to avoid unnecessary connections.
 */
class WorkspaceApiClientManager {
  private clients: Map<string, N8nApiClient> = new Map();
  private workspaceConfig: MultiWorkspaceConfig;

  constructor() {
    this.workspaceConfig = getWorkspaceConfig();
  }

  /**
   * Get or create an API client for a workspace
   */
  private getOrCreateClient(workspace: WorkspaceConfig): N8nApiClient {
    let client = this.clients.get(workspace.name);
    if (!client) {
      client = new N8nApiClient({
        baseUrl: workspace.url,
        apiKey: workspace.token,
      });
      this.clients.set(workspace.name, client);
      logger.debug(`Created API client for workspace '${workspace.name}'`);
    }
    return client;
  }

  /**
   * Get API client for a workspace by name
   * Returns null if workspace not found
   */
  getClient(workspaceName?: string): N8nApiClient | null {
    const workspace = getWorkspace(this.workspaceConfig, workspaceName);
    if (!workspace) return null;
    return this.getOrCreateClient(workspace);
  }

  /**
   * Get InstanceContext for a workspace
   * This allows integration with existing handler functions that use InstanceContext
   */
  getInstanceContext(workspaceName?: string): InstanceContext | null {
    const workspace = getWorkspace(this.workspaceConfig, workspaceName);
    if (!workspace) return null;
    return workspaceToInstanceContext(workspace);
  }

  /**
   * Check if multi-workspace mode is enabled
   */
  isMultiWorkspace(): boolean {
    return isMultiWorkspaceMode(this.workspaceConfig);
  }

  /**
   * Get list of available workspace names
   */
  getAvailableWorkspaces(): string[] {
    return getAvailableWorkspaces(this.workspaceConfig);
  }

  /**
   * Get the default workspace name
   */
  getDefaultWorkspace(): string | null {
    return this.workspaceConfig.defaultWorkspace;
  }

  /**
   * Get workspace configuration by name
   */
  getWorkspaceConfig(workspaceName?: string): WorkspaceConfig | null {
    return getWorkspace(this.workspaceConfig, workspaceName);
  }

  /**
   * Generate error message for invalid workspace
   */
  getWorkspaceNotFoundError(workspaceName?: string): string {
    const available = this.getAvailableWorkspaces();
    if (workspaceName) {
      return `Workspace '${workspaceName}' not found. Available workspaces: ${available.join(', ') || 'none'}`;
    }
    return `No n8n workspace configured. Set N8N_URL_* and N8N_TOKEN_* env vars, or N8N_API_URL and N8N_API_KEY for single-instance mode.`;
  }
}

// Singleton instance
let manager: WorkspaceApiClientManager | null = null;

/**
 * Get the workspace API client manager singleton
 */
export function getWorkspaceApiClientManager(): WorkspaceApiClientManager {
  if (!manager) {
    manager = new WorkspaceApiClientManager();
  }
  return manager;
}

/**
 * Reset the manager singleton (for testing)
 */
export function resetWorkspaceApiClientManager(): void {
  manager = null;
}

/**
 * Helper to get InstanceContext from workspace parameter
 * Used by tool handlers to convert workspace name to InstanceContext
 */
export function resolveWorkspaceContext(workspaceName?: string): InstanceContext | null {
  return getWorkspaceApiClientManager().getInstanceContext(workspaceName);
}

/**
 * Helper to check if workspace parameter should be shown in tool schemas
 */
export function shouldShowWorkspaceParam(): boolean {
  return getWorkspaceApiClientManager().isMultiWorkspace();
}

/**
 * Get workspace parameter schema for tool definitions
 * Returns null if single-workspace mode (no param needed)
 */
export function getWorkspaceParamSchema(): Record<string, unknown> | null {
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
