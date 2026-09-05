"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BREAKING_CHANGES_REGISTRY = void 0;
exports.getBreakingChangesForNode = getBreakingChangesForNode;
exports.getAllChangesForNode = getAllChangesForNode;
exports.getAutoMigratableChanges = getAutoMigratableChanges;
exports.hasBreakingChanges = hasBreakingChanges;
exports.getMigrationHints = getMigrationHints;
exports.getNodesWithVersionMigrations = getNodesWithVersionMigrations;
exports.getTrackedVersionsForNode = getTrackedVersionsForNode;
exports.BREAKING_CHANGES_REGISTRY = [
    {
        nodeType: 'n8n-nodes-base.executeWorkflow',
        fromVersion: '1.0',
        toVersion: '1.1',
        propertyName: 'parameters.inputFieldMapping',
        changeType: 'added',
        isBreaking: true,
        migrationHint: 'In v1.1+, the Execute Workflow node requires explicit field mapping to pass data to sub-workflows. Add an "inputFieldMapping" object with "mappings" array defining how to map fields from parent to child workflow.',
        autoMigratable: true,
        migrationStrategy: {
            type: 'add_property',
            defaultValue: {
                mappings: []
            }
        },
        severity: 'HIGH'
    },
    {
        nodeType: 'n8n-nodes-base.executeWorkflow',
        fromVersion: '1.0',
        toVersion: '1.1',
        propertyName: 'parameters.mode',
        changeType: 'requirement_changed',
        isBreaking: false,
        migrationHint: 'The "mode" parameter behavior changed in v1.1. Default is now "static" instead of "list". Ensure your workflow ID specification matches the selected mode.',
        autoMigratable: false,
        severity: 'MEDIUM'
    },
    {
        nodeType: 'n8n-nodes-base.webhook',
        fromVersion: '2.0',
        toVersion: '2.1',
        propertyName: 'webhookId',
        changeType: 'added',
        isBreaking: true,
        migrationHint: 'In v2.1+, webhooks require a unique "webhookId" field in addition to the path. This ensures webhook persistence across workflow updates. A UUID will be auto-generated if not provided.',
        autoMigratable: true,
        migrationStrategy: {
            type: 'add_property',
            defaultValue: null
        },
        severity: 'HIGH'
    },
    {
        nodeType: 'n8n-nodes-base.webhook',
        fromVersion: '1.0',
        toVersion: '2.0',
        propertyName: 'parameters.path',
        changeType: 'requirement_changed',
        isBreaking: true,
        migrationHint: 'In v2.0+, the webhook path must be explicitly defined and cannot be empty. Ensure a valid path is set.',
        autoMigratable: false,
        severity: 'HIGH'
    },
    {
        nodeType: 'n8n-nodes-base.webhook',
        fromVersion: '1.0',
        toVersion: '2.0',
        propertyName: 'parameters.responseMode',
        changeType: 'added',
        isBreaking: false,
        migrationHint: 'v2.0 introduces a "responseMode" parameter to control how the webhook responds. Default is "onReceived" (immediate response). Use "lastNode" to wait for workflow completion.',
        autoMigratable: true,
        migrationStrategy: {
            type: 'add_property',
            defaultValue: 'onReceived'
        },
        severity: 'LOW'
    },
    {
        nodeType: 'n8n-nodes-base.httpRequest',
        fromVersion: '4.1',
        toVersion: '4.2',
        propertyName: 'parameters.sendBody',
        changeType: 'requirement_changed',
        isBreaking: false,
        migrationHint: 'In v4.2+, "sendBody" must be explicitly set to true for POST/PUT/PATCH requests to include a body. Previous versions had implicit body sending.',
        autoMigratable: true,
        migrationStrategy: {
            type: 'add_property',
            defaultValue: true
        },
        severity: 'MEDIUM'
    },
    {
        nodeType: 'n8n-nodes-base.code',
        fromVersion: '1.0',
        toVersion: '2.0',
        propertyName: 'parameters.mode',
        changeType: 'added',
        isBreaking: false,
        migrationHint: 'v2.0 introduces execution modes: "runOnceForAllItems" (default) and "runOnceForEachItem". The default mode processes all items at once, which may differ from v1.0 behavior.',
        autoMigratable: true,
        migrationStrategy: {
            type: 'add_property',
            defaultValue: 'runOnceForAllItems'
        },
        severity: 'MEDIUM'
    },
    {
        nodeType: 'n8n-nodes-base.scheduleTrigger',
        fromVersion: '1.0',
        toVersion: '1.1',
        propertyName: 'parameters.rule.interval',
        changeType: 'type_changed',
        isBreaking: true,
        oldValue: 'string',
        newValue: 'array',
        migrationHint: 'In v1.1+, the interval parameter changed from a single string to an array of interval objects. Convert your single interval to an array format: [{field: "hours", value: 1}]',
        autoMigratable: false,
        severity: 'HIGH'
    },
    {
        nodeType: '*',
        fromVersion: '1.0',
        toVersion: '2.0',
        propertyName: 'continueOnFail',
        changeType: 'removed',
        isBreaking: false,
        migrationHint: 'The "continueOnFail" property is deprecated. Use "onError" instead with value "continueErrorOutput" or "continueRegularOutput".',
        autoMigratable: true,
        migrationStrategy: {
            type: 'rename_property',
            sourceProperty: 'continueOnFail',
            targetProperty: 'onError',
            defaultValue: 'continueErrorOutput'
        },
        severity: 'MEDIUM'
    }
];
function getBreakingChangesForNode(nodeType, fromVersion, toVersion) {
    return getAllChangesForNode(nodeType, fromVersion, toVersion).filter(change => change.isBreaking);
}
function getAllChangesForNode(nodeType, fromVersion, toVersion) {
    return exports.BREAKING_CHANGES_REGISTRY.filter(change => {
        const nodeMatches = change.nodeType === nodeType || change.nodeType === '*';
        const versionMatches = compareVersions(change.fromVersion, fromVersion) >= 0 &&
            compareVersions(change.toVersion, toVersion) <= 0;
        return nodeMatches && versionMatches;
    });
}
function getAutoMigratableChanges(nodeType, fromVersion, toVersion) {
    return getAllChangesForNode(nodeType, fromVersion, toVersion).filter(change => change.autoMigratable);
}
function hasBreakingChanges(nodeType, fromVersion, toVersion) {
    return getBreakingChangesForNode(nodeType, fromVersion, toVersion).length > 0;
}
function getMigrationHints(nodeType, fromVersion, toVersion) {
    const changes = getAllChangesForNode(nodeType, fromVersion, toVersion);
    return changes.map(change => change.migrationHint);
}
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 < p2)
            return -1;
        if (p1 > p2)
            return 1;
    }
    return 0;
}
function getNodesWithVersionMigrations() {
    const nodeTypes = new Set();
    exports.BREAKING_CHANGES_REGISTRY.forEach(change => {
        if (change.nodeType !== '*') {
            nodeTypes.add(change.nodeType);
        }
    });
    return Array.from(nodeTypes);
}
function getTrackedVersionsForNode(nodeType) {
    const versions = new Set();
    exports.BREAKING_CHANGES_REGISTRY
        .filter(change => change.nodeType === nodeType || change.nodeType === '*')
        .forEach(change => {
        versions.add(change.fromVersion);
        versions.add(change.toVersion);
    });
    return Array.from(versions).sort((a, b) => compareVersions(a, b));
}
//# sourceMappingURL=breaking-changes-registry.js.map