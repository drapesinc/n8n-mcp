"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowVersioningService = void 0;
const workflow_validator_1 = require("./workflow-validator");
const enhanced_config_validator_1 = require("./enhanced-config-validator");
class WorkflowVersioningService {
    constructor(nodeRepository, apiClient, instanceId = '') {
        this.nodeRepository = nodeRepository;
        this.apiClient = apiClient;
        this.instanceId = instanceId;
        this.DEFAULT_MAX_VERSIONS = 10;
    }
    async createBackup(workflowId, workflow, context) {
        const versions = this.nodeRepository.getWorkflowVersions(workflowId, this.instanceId, 1);
        const nextVersion = versions.length > 0 ? versions[0].versionNumber + 1 : 1;
        const versionId = this.nodeRepository.createWorkflowVersion({
            instanceId: this.instanceId,
            workflowId,
            versionNumber: nextVersion,
            workflowName: workflow.name || 'Unnamed Workflow',
            workflowSnapshot: workflow,
            trigger: context.trigger,
            operations: context.operations,
            fixTypes: context.fixTypes,
            metadata: context.metadata
        });
        const pruned = this.nodeRepository.pruneWorkflowVersions(workflowId, this.DEFAULT_MAX_VERSIONS, this.instanceId);
        return {
            versionId,
            versionNumber: nextVersion,
            pruned,
            message: pruned > 0
                ? `Backup created (version ${nextVersion}), pruned ${pruned} old version(s)`
                : `Backup created (version ${nextVersion})`
        };
    }
    async getVersionHistory(workflowId, limit = 10) {
        const versions = this.nodeRepository.getWorkflowVersions(workflowId, this.instanceId, limit);
        return versions.map(v => ({
            id: v.id,
            workflowId: v.workflowId,
            versionNumber: v.versionNumber,
            workflowName: v.workflowName,
            trigger: v.trigger,
            operationCount: v.operations ? v.operations.length : undefined,
            fixTypesApplied: v.fixTypes || undefined,
            createdAt: v.createdAt,
            size: JSON.stringify(v.workflowSnapshot).length
        }));
    }
    async getVersion(versionId) {
        return this.nodeRepository.getWorkflowVersion(versionId, this.instanceId);
    }
    async restoreVersion(workflowId, versionId, validateBefore = true) {
        if (!this.apiClient) {
            return {
                success: false,
                message: 'API client not configured - cannot restore workflow',
                workflowId,
                toVersionId: versionId || 0,
                backupCreated: false
            };
        }
        let versionToRestore = null;
        if (versionId) {
            versionToRestore = this.nodeRepository.getWorkflowVersion(versionId, this.instanceId);
        }
        else {
            versionToRestore = this.nodeRepository.getLatestWorkflowVersion(workflowId, this.instanceId);
        }
        if (!versionToRestore) {
            return {
                success: false,
                message: versionId
                    ? `Version ${versionId} not found`
                    : `No backup versions found for workflow ${workflowId}`,
                workflowId,
                toVersionId: versionId || 0,
                backupCreated: false
            };
        }
        if (validateBefore) {
            const validator = new workflow_validator_1.WorkflowValidator(this.nodeRepository, enhanced_config_validator_1.EnhancedConfigValidator);
            const validationResult = await validator.validateWorkflow(versionToRestore.workflowSnapshot, {
                validateNodes: true,
                validateConnections: true,
                validateExpressions: false,
                profile: 'runtime'
            });
            if (validationResult.errors.length > 0) {
                return {
                    success: false,
                    message: `Cannot restore - version ${versionToRestore.versionNumber} has validation errors`,
                    workflowId,
                    toVersionId: versionToRestore.id,
                    backupCreated: false,
                    validationErrors: validationResult.errors.map(e => e.message || 'Unknown error')
                };
            }
        }
        let backupResult;
        try {
            const currentWorkflow = await this.apiClient.getWorkflow(workflowId);
            backupResult = await this.createBackup(workflowId, currentWorkflow, {
                trigger: 'partial_update',
                metadata: {
                    reason: 'Backup before rollback',
                    restoringToVersion: versionToRestore.versionNumber
                }
            });
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to create backup before restore: ${error.message}`,
                workflowId,
                toVersionId: versionToRestore.id,
                backupCreated: false
            };
        }
        try {
            await this.apiClient.updateWorkflow(workflowId, versionToRestore.workflowSnapshot);
            return {
                success: true,
                message: `Successfully restored workflow to version ${versionToRestore.versionNumber}`,
                workflowId,
                fromVersion: backupResult.versionNumber,
                toVersionId: versionToRestore.id,
                backupCreated: true,
                backupVersionId: backupResult.versionId
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to restore workflow: ${error.message}`,
                workflowId,
                toVersionId: versionToRestore.id,
                backupCreated: true,
                backupVersionId: backupResult.versionId
            };
        }
    }
    async deleteVersion(versionId) {
        const version = this.nodeRepository.getWorkflowVersion(versionId, this.instanceId);
        if (!version) {
            return {
                success: false,
                message: `Version ${versionId} not found`
            };
        }
        this.nodeRepository.deleteWorkflowVersion(versionId, this.instanceId);
        return {
            success: true,
            message: `Deleted version ${version.versionNumber} for workflow ${version.workflowId}`
        };
    }
    async deleteAllVersions(workflowId) {
        const count = this.nodeRepository.getWorkflowVersionCount(workflowId, this.instanceId);
        if (count === 0) {
            return {
                deleted: 0,
                message: `No versions found for workflow ${workflowId}`
            };
        }
        const deleted = this.nodeRepository.deleteWorkflowVersionsByWorkflowId(workflowId, this.instanceId);
        return {
            deleted,
            message: `Deleted ${deleted} version(s) for workflow ${workflowId}`
        };
    }
    async pruneVersions(workflowId, maxVersions = 10) {
        const pruned = this.nodeRepository.pruneWorkflowVersions(workflowId, maxVersions, this.instanceId);
        const remaining = this.nodeRepository.getWorkflowVersionCount(workflowId, this.instanceId);
        return { pruned, remaining };
    }
    async getStorageStats() {
        const stats = this.nodeRepository.getVersionStorageStats(this.instanceId);
        return {
            totalVersions: stats.totalVersions,
            totalSize: stats.totalSize,
            totalSizeFormatted: this.formatBytes(stats.totalSize),
            byWorkflow: stats.byWorkflow.map((w) => ({
                workflowId: w.workflowId,
                workflowName: w.workflowName,
                versionCount: w.versionCount,
                totalSize: w.totalSize,
                totalSizeFormatted: this.formatBytes(w.totalSize),
                lastBackup: w.lastBackup
            }))
        };
    }
    async compareVersions(versionId1, versionId2) {
        const v1 = this.nodeRepository.getWorkflowVersion(versionId1, this.instanceId);
        const v2 = this.nodeRepository.getWorkflowVersion(versionId2, this.instanceId);
        if (!v1 || !v2) {
            throw new Error(`One or both versions not found: ${versionId1}, ${versionId2}`);
        }
        const nodes1 = new Set(v1.workflowSnapshot.nodes?.map((n) => n.id) || []);
        const nodes2 = new Set(v2.workflowSnapshot.nodes?.map((n) => n.id) || []);
        const addedNodes = [...nodes2].filter(id => !nodes1.has(id));
        const removedNodes = [...nodes1].filter(id => !nodes2.has(id));
        const commonNodes = [...nodes1].filter(id => nodes2.has(id));
        const modifiedNodes = [];
        for (const nodeId of commonNodes) {
            const node1 = v1.workflowSnapshot.nodes?.find((n) => n.id === nodeId);
            const node2 = v2.workflowSnapshot.nodes?.find((n) => n.id === nodeId);
            if (JSON.stringify(node1) !== JSON.stringify(node2)) {
                modifiedNodes.push(nodeId);
            }
        }
        const conn1Str = JSON.stringify(v1.workflowSnapshot.connections || {});
        const conn2Str = JSON.stringify(v2.workflowSnapshot.connections || {});
        const connectionChanges = conn1Str !== conn2Str ? 1 : 0;
        const settings1 = v1.workflowSnapshot.settings || {};
        const settings2 = v2.workflowSnapshot.settings || {};
        const settingChanges = this.diffObjects(settings1, settings2);
        return {
            versionId1,
            versionId2,
            version1Number: v1.versionNumber,
            version2Number: v2.versionNumber,
            addedNodes,
            removedNodes,
            modifiedNodes,
            connectionChanges,
            settingChanges
        };
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
    diffObjects(obj1, obj2) {
        const changes = {};
        const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
        for (const key of allKeys) {
            if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
                changes[key] = {
                    before: obj1[key],
                    after: obj2[key]
                };
            }
        }
        return changes;
    }
}
exports.WorkflowVersioningService = WorkflowVersioningService;
//# sourceMappingURL=workflow-versioning-service.js.map