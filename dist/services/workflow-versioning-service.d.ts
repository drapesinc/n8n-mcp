import { NodeRepository } from '../database/node-repository';
import { N8nApiClient } from './n8n-api-client';
export interface WorkflowVersion {
    id: number;
    workflowId: string;
    versionNumber: number;
    workflowName: string;
    workflowSnapshot: any;
    trigger: 'partial_update' | 'full_update' | 'autofix';
    operations?: any[];
    fixTypes?: string[];
    metadata?: any;
    createdAt: string;
}
export interface VersionInfo {
    id: number;
    workflowId: string;
    versionNumber: number;
    workflowName: string;
    trigger: string;
    operationCount?: number;
    fixTypesApplied?: string[];
    createdAt: string;
    size: number;
}
export interface RestoreResult {
    success: boolean;
    message: string;
    workflowId: string;
    fromVersion?: number;
    toVersionId: number;
    backupCreated: boolean;
    backupVersionId?: number;
    validationErrors?: string[];
}
export interface BackupResult {
    versionId: number;
    versionNumber: number;
    pruned: number;
    message: string;
}
export interface StorageStats {
    totalVersions: number;
    totalSize: number;
    totalSizeFormatted: string;
    byWorkflow: WorkflowStorageInfo[];
}
export interface WorkflowStorageInfo {
    workflowId: string;
    workflowName: string;
    versionCount: number;
    totalSize: number;
    totalSizeFormatted: string;
    lastBackup: string;
}
export interface VersionDiff {
    versionId1: number;
    versionId2: number;
    version1Number: number;
    version2Number: number;
    addedNodes: string[];
    removedNodes: string[];
    modifiedNodes: string[];
    connectionChanges: number;
    settingChanges: any;
}
export declare class WorkflowVersioningService {
    private nodeRepository;
    private apiClient?;
    private instanceId;
    private readonly DEFAULT_MAX_VERSIONS;
    constructor(nodeRepository: NodeRepository, apiClient?: N8nApiClient | undefined, instanceId?: string);
    createBackup(workflowId: string, workflow: any, context: {
        trigger: 'partial_update' | 'full_update' | 'autofix';
        operations?: any[];
        fixTypes?: string[];
        metadata?: any;
    }): Promise<BackupResult>;
    getVersionHistory(workflowId: string, limit?: number): Promise<VersionInfo[]>;
    getVersion(versionId: number): Promise<WorkflowVersion | null>;
    restoreVersion(workflowId: string, versionId?: number, validateBefore?: boolean): Promise<RestoreResult>;
    deleteVersion(versionId: number): Promise<{
        success: boolean;
        message: string;
    }>;
    deleteAllVersions(workflowId: string): Promise<{
        deleted: number;
        message: string;
    }>;
    pruneVersions(workflowId: string, maxVersions?: number): Promise<{
        pruned: number;
        remaining: number;
    }>;
    getStorageStats(): Promise<StorageStats>;
    compareVersions(versionId1: number, versionId2: number): Promise<VersionDiff>;
    private formatBytes;
    private diffObjects;
}
//# sourceMappingURL=workflow-versioning-service.d.ts.map