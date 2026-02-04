import { N8nApiClient } from './n8n-api-client';
import { type WorkspaceConfig } from '../config/workspace-config';
import { InstanceContext } from '../types/instance-context';
declare class WorkspaceApiClientManager {
    private clients;
    private workspaceConfig;
    constructor();
    private getOrCreateClient;
    getClient(workspaceName?: string): N8nApiClient | null;
    getInstanceContext(workspaceName?: string): InstanceContext | null;
    isMultiWorkspace(): boolean;
    getAvailableWorkspaces(): string[];
    getDefaultWorkspace(): string | null;
    getWorkspaceConfig(workspaceName?: string): WorkspaceConfig | null;
    getWorkspaceNotFoundError(workspaceName?: string): string;
}
export declare function getWorkspaceApiClientManager(): WorkspaceApiClientManager;
export declare function resetWorkspaceApiClientManager(): void;
export declare function resolveWorkspaceContext(workspaceName?: string): InstanceContext | null;
export declare function shouldShowWorkspaceParam(): boolean;
export declare function getWorkspaceParamSchema(): Record<string, unknown> | null;
export {};
//# sourceMappingURL=workspace-api-client.d.ts.map