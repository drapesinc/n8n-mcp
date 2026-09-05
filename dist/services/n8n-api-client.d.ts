import { Workflow, WorkflowListParams, WorkflowListResponse, Execution, ExecutionListParams, ExecutionListResponse, TestRunSummary, TestRunListParams, TestCaseListParams, TestRunListResponse, TestCaseListResponse, TestRunTriggerResult, TestRunCancelResult, Credential, CredentialListParams, CredentialListResponse, Tag, TagListParams, TagListResponse, HealthCheckResponse, N8nVersionInfo, Variable, WebhookRequest, SourceControlStatus, SourceControlPullResult, SourceControlPushResult, DataTable, DataTableColumn, DataTableListParams, DataTableRow, DataTableRowListParams, DataTableInsertRowsParams, DataTableUpdateRowsParams, DataTableUpsertRowParams, DataTableDeleteRowsParams, Folder, FolderListParams, FolderListResponse, Project } from '../types/n8n-api';
export interface N8nApiClientConfig {
    baseUrl: string;
    apiKey: string;
    timeout?: number;
    maxRetries?: number;
    cfClientId?: string;
    cfClientSecret?: string;
}
export interface WorkflowWriteOptions {
    authoredGroups?: Set<string>;
    onWarning?: (message: string) => void;
}
export declare class N8nApiClient {
    private client;
    private maxRetries;
    private baseUrl;
    private versionInfo;
    private versionPromise;
    private personalProjectId;
    private pinnedAgentsPromise;
    private pinnedAgentsResolvedAt;
    private static readonly PINNED_AGENTS_TTL_MS;
    private cfClientId?;
    private cfClientSecret?;
    private groupSupport;
    private rejectedSettings;
    private modernPublishRoute;
    constructor(config: N8nApiClientConfig);
    private tryRetry;
    private isRetryableConnectionError;
    private extractErrorCodes;
    private getPinnedAgents;
    getVersion(): Promise<N8nVersionInfo | null>;
    private cfAccessHeaders;
    private cfAccessHeadersOrUndefined;
    private isSameOrigin;
    private fetchVersionOnce;
    getCachedVersionInfo(): N8nVersionInfo | null;
    refreshVersion(): Promise<N8nVersionInfo | null>;
    healthCheck(): Promise<HealthCheckResponse>;
    private sendWorkflowWrite;
    private sendWorkflowWriteWithSettingsFallback;
    private sendWorkflowWriteWithGroupFallback;
    private degradeGroupsAfterRejection;
    private putOrPatchWorkflow;
    private repairGroupsForWrite;
    createWorkflow(workflow: Partial<Workflow>, options?: WorkflowWriteOptions): Promise<Workflow>;
    getWorkflow(id: string): Promise<Workflow>;
    updateWorkflow(id: string, workflow: Partial<Workflow>, options?: WorkflowWriteOptions): Promise<Workflow>;
    deleteWorkflow(id: string): Promise<Workflow>;
    transferWorkflow(id: string, destinationProjectId: string): Promise<void>;
    private postPublishRoute;
    private confirmModernPublishRoute;
    activateWorkflow(id: string): Promise<Workflow>;
    deactivateWorkflow(id: string): Promise<Workflow>;
    listWorkflows(params?: WorkflowListParams): Promise<WorkflowListResponse>;
    generateAudit(options?: {
        categories?: string[];
        daysAbandonedWorkflow?: number;
    }): Promise<any>;
    listAllWorkflows(): Promise<Workflow[]>;
    getExecution(id: string, includeData?: boolean): Promise<Execution>;
    listExecutions(params?: ExecutionListParams): Promise<ExecutionListResponse>;
    deleteExecution(id: string): Promise<void>;
    listTestRuns(workflowId: string, params?: TestRunListParams): Promise<TestRunListResponse>;
    getTestRun(workflowId: string, runId: string): Promise<TestRunSummary>;
    listTestCases(workflowId: string, runId: string, params?: TestCaseListParams): Promise<TestCaseListResponse>;
    triggerTestRun(workflowId: string): Promise<TestRunTriggerResult>;
    cancelTestRun(workflowId: string, runId: string): Promise<TestRunCancelResult>;
    triggerWebhook(request: WebhookRequest): Promise<any>;
    listCredentials(params?: CredentialListParams): Promise<CredentialListResponse>;
    listAllCredentials(): Promise<Credential[]>;
    getCredential(id: string): Promise<Credential>;
    createCredential(credential: Partial<Credential>): Promise<Credential>;
    updateCredential(id: string, credential: Partial<Credential>): Promise<Credential>;
    deleteCredential(id: string): Promise<void>;
    getCredentialSchema(typeName: string): Promise<any>;
    listTags(params?: TagListParams): Promise<TagListResponse>;
    createTag(tag: Partial<Tag>): Promise<Tag>;
    updateTag(id: string, tag: Partial<Tag>): Promise<Tag>;
    deleteTag(id: string): Promise<void>;
    updateWorkflowTags(workflowId: string, tagIds: string[]): Promise<Tag[]>;
    getSourceControlStatus(): Promise<SourceControlStatus>;
    pullSourceControl(force?: boolean): Promise<SourceControlPullResult>;
    pushSourceControl(message: string, fileNames?: string[]): Promise<SourceControlPushResult>;
    getVariables(): Promise<Variable[]>;
    createVariable(variable: Partial<Variable>): Promise<Variable>;
    updateVariable(id: string, variable: Partial<Variable>): Promise<Variable>;
    deleteVariable(id: string): Promise<void>;
    createDataTable(params: {
        name: string;
        columns?: DataTableColumn[];
        projectId?: string;
    }): Promise<DataTable>;
    listDataTables(params?: DataTableListParams): Promise<{
        data: DataTable[];
        nextCursor?: string | null;
    }>;
    getDataTable(id: string): Promise<DataTable>;
    updateDataTable(id: string, params: {
        name: string;
    }): Promise<DataTable>;
    deleteDataTable(id: string): Promise<void>;
    getDataTableRows(id: string, params?: DataTableRowListParams): Promise<{
        data: DataTableRow[];
        nextCursor?: string | null;
    }>;
    insertDataTableRows(id: string, params: DataTableInsertRowsParams): Promise<any>;
    updateDataTableRows(id: string, params: DataTableUpdateRowsParams): Promise<any>;
    upsertDataTableRow(id: string, params: DataTableUpsertRowParams): Promise<any>;
    deleteDataTableRows(id: string, params: DataTableDeleteRowsParams): Promise<any>;
    createFolder(projectId: string, data: {
        name: string;
        parentFolderId?: string;
    }): Promise<Folder>;
    listFolders(projectId: string, params?: FolderListParams): Promise<FolderListResponse>;
    getFolder(projectId: string, folderId: string): Promise<Folder>;
    updateFolder(projectId: string, folderId: string, data: {
        name?: string;
        parentFolderId?: string;
    }): Promise<Folder>;
    deleteFolder(projectId: string, folderId: string, transferToFolderId?: string): Promise<void>;
    listProjects(limit?: number): Promise<Project[]>;
    resolvePersonalProjectId(): Promise<string>;
    private serializeQueryParams;
    private validateListResponse;
}
//# sourceMappingURL=n8n-api-client.d.ts.map