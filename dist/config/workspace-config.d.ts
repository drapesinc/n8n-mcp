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
export declare function loadWorkspaceConfig(): MultiWorkspaceConfig;
export declare function getWorkspace(config: MultiWorkspaceConfig, name?: string): WorkspaceConfig | null;
export declare function isMultiWorkspaceMode(config: MultiWorkspaceConfig): boolean;
export declare function getAvailableWorkspaces(config: MultiWorkspaceConfig): string[];
export declare function workspaceToInstanceContext(workspace: WorkspaceConfig): {
    n8nApiUrl: string;
    n8nApiKey: string;
    instanceId: string;
};
export declare function describeWorkspaceConfig(config: MultiWorkspaceConfig): string;
export declare function getWorkspaceConfig(): MultiWorkspaceConfig;
export declare function resetWorkspaceConfig(): void;
//# sourceMappingURL=workspace-config.d.ts.map