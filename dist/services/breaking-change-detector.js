"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BreakingChangeDetector = void 0;
const breaking_changes_registry_1 = require("./breaking-changes-registry");
class BreakingChangeDetector {
    constructor(nodeRepository) {
        this.nodeRepository = nodeRepository;
    }
    async analyzeVersionUpgrade(nodeType, fromVersion, toVersion) {
        const registryChanges = this.getRegistryChanges(nodeType, fromVersion, toVersion);
        const dynamicChanges = this.detectDynamicChanges(nodeType, fromVersion, toVersion);
        const allChanges = this.mergeChanges(registryChanges, dynamicChanges);
        const hasBreakingChanges = allChanges.some(c => c.isBreaking);
        const autoMigratableCount = allChanges.filter(c => c.autoMigratable).length;
        const manualRequiredCount = allChanges.filter(c => !c.autoMigratable).length;
        const overallSeverity = this.calculateOverallSeverity(allChanges);
        const recommendations = this.generateRecommendations(allChanges);
        return {
            nodeType,
            fromVersion,
            toVersion,
            hasBreakingChanges,
            changes: allChanges,
            autoMigratableCount,
            manualRequiredCount,
            overallSeverity,
            recommendations
        };
    }
    getRegistryChanges(nodeType, fromVersion, toVersion) {
        const registryChanges = (0, breaking_changes_registry_1.getAllChangesForNode)(nodeType, fromVersion, toVersion);
        return registryChanges.map(change => ({
            propertyName: change.propertyName,
            fromVersion: change.fromVersion,
            toVersion: change.toVersion,
            changeType: change.changeType,
            isBreaking: change.isBreaking,
            oldValue: change.oldValue,
            newValue: change.newValue,
            migrationHint: change.migrationHint,
            autoMigratable: change.autoMigratable,
            migrationStrategy: change.migrationStrategy,
            severity: change.severity,
            source: 'registry'
        }));
    }
    detectDynamicChanges(nodeType, fromVersion, toVersion) {
        const oldVersionData = this.nodeRepository.getNodeVersion(nodeType, fromVersion);
        const newVersionData = this.nodeRepository.getNodeVersion(nodeType, toVersion);
        if (!oldVersionData || !newVersionData) {
            return [];
        }
        const changes = [];
        const oldProps = this.flattenProperties(oldVersionData.propertiesSchema || [], 'parameters');
        const newProps = this.flattenProperties(newVersionData.propertiesSchema || [], 'parameters');
        for (const propName of Object.keys(newProps)) {
            if (!oldProps[propName]) {
                const prop = newProps[propName];
                const isRequired = prop.required === true;
                changes.push({
                    propertyName: propName,
                    changeType: 'added',
                    isBreaking: isRequired,
                    newValue: prop.type || 'unknown',
                    migrationHint: isRequired
                        ? `Property "${propName}" is now required in v${toVersion}. Provide a value to prevent validation errors.`
                        : `Property "${propName}" was added in v${toVersion}. Optional; n8n applies its default when it is not set.`,
                    autoMigratable: !isRequired,
                    severity: isRequired ? 'HIGH' : 'LOW',
                    source: 'dynamic'
                });
            }
        }
        for (const propName of Object.keys(oldProps)) {
            if (!newProps[propName]) {
                changes.push({
                    propertyName: propName,
                    changeType: 'removed',
                    isBreaking: true,
                    oldValue: oldProps[propName].type || 'unknown',
                    migrationHint: `Property "${propName}" no longer exists in v${toVersion}. If it is set, move its value to the replacement property before upgrading.`,
                    autoMigratable: false,
                    severity: 'MEDIUM',
                    source: 'dynamic'
                });
            }
        }
        for (const propName of Object.keys(newProps)) {
            if (oldProps[propName]) {
                const oldProp = oldProps[propName];
                const newProp = newProps[propName];
                if (oldProp.type && newProp.type && oldProp.type !== newProp.type) {
                    changes.push({
                        propertyName: propName,
                        changeType: 'type_changed',
                        isBreaking: true,
                        oldValue: oldProp.type,
                        newValue: newProp.type,
                        migrationHint: `Property "${propName}" changed type from ${oldProp.type} to ${newProp.type} in v${toVersion}. Review the configured value.`,
                        autoMigratable: false,
                        severity: 'HIGH',
                        source: 'dynamic'
                    });
                }
                else if (oldProp.default !== undefined &&
                    newProp.default !== undefined &&
                    JSON.stringify(oldProp.default) !== JSON.stringify(newProp.default)) {
                    changes.push({
                        propertyName: propName,
                        changeType: 'default_changed',
                        isBreaking: false,
                        oldValue: oldProp.default,
                        newValue: newProp.default,
                        migrationHint: `Default of "${propName}" changed in v${toVersion}. Nodes that relied on the old default now behave differently unless the value is set explicitly.`,
                        autoMigratable: false,
                        severity: 'LOW',
                        source: 'dynamic'
                    });
                }
                const oldRequired = oldProp.required === true;
                const newRequired = newProp.required === true;
                if (oldRequired !== newRequired) {
                    changes.push({
                        propertyName: propName,
                        changeType: 'requirement_changed',
                        isBreaking: newRequired && !oldRequired,
                        oldValue: oldRequired ? 'required' : 'optional',
                        newValue: newRequired ? 'required' : 'optional',
                        migrationHint: newRequired
                            ? `Property "${propName}" is now required in v${toVersion}. Ensure a value is provided.`
                            : `Property "${propName}" is now optional in v${toVersion}.`,
                        autoMigratable: false,
                        severity: newRequired ? 'HIGH' : 'LOW',
                        source: 'dynamic'
                    });
                }
            }
        }
        return changes;
    }
    flattenProperties(properties, prefix = '') {
        const flat = {};
        for (const prop of properties) {
            if (!prop.name && !prop.displayName)
                continue;
            const propName = prop.name || prop.displayName;
            const fullPath = prefix ? `${prefix}.${propName}` : propName;
            flat[fullPath] = prop;
            if (prop.type === 'collection' && Array.isArray(prop.options)) {
                Object.assign(flat, this.flattenProperties(prop.options, fullPath));
            }
            else if (prop.type === 'fixedCollection' && Array.isArray(prop.options)) {
                for (const group of prop.options) {
                    if (!group?.name || !Array.isArray(group.values))
                        continue;
                    Object.assign(flat, this.flattenProperties(group.values, `${fullPath}.${group.name}`));
                }
            }
        }
        return flat;
    }
    mergeChanges(registryChanges, dynamicChanges) {
        const merged = [...registryChanges];
        for (const dynamicChange of dynamicChanges) {
            const existsInRegistry = registryChanges.some(rc => rc.propertyName === dynamicChange.propertyName &&
                rc.changeType === dynamicChange.changeType);
            if (!existsInRegistry) {
                merged.push(dynamicChange);
            }
        }
        const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        merged.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
        return merged;
    }
    calculateOverallSeverity(changes) {
        if (changes.some(c => c.severity === 'HIGH'))
            return 'HIGH';
        if (changes.some(c => c.severity === 'MEDIUM'))
            return 'MEDIUM';
        return 'LOW';
    }
    generateRecommendations(changes) {
        const recommendations = [];
        const breakingChanges = changes.filter(c => c.isBreaking);
        const autoMigratable = changes.filter(c => c.autoMigratable);
        const manualRequired = changes.filter(c => !c.autoMigratable);
        if (breakingChanges.length === 0) {
            recommendations.push('✓ No breaking changes detected. This upgrade should be safe.');
        }
        else {
            recommendations.push(`⚠ ${breakingChanges.length} breaking change(s) detected. Review carefully before applying.`);
        }
        if (autoMigratable.length > 0) {
            recommendations.push(`✓ ${autoMigratable.length} change(s) can be automatically migrated.`);
        }
        if (manualRequired.length > 0) {
            recommendations.push(`✋ ${manualRequired.length} change(s) require manual intervention.`);
            for (const change of manualRequired) {
                recommendations.push(`  - ${change.propertyName}: ${change.migrationHint}`);
            }
        }
        return recommendations;
    }
    hasBreakingChanges(nodeType, fromVersion, toVersion) {
        if ((0, breaking_changes_registry_1.getBreakingChangesForNode)(nodeType, fromVersion, toVersion).length > 0)
            return true;
        return this.detectDynamicChanges(nodeType, fromVersion, toVersion).some(c => c.isBreaking);
    }
    getChangedProperties(nodeType, fromVersion, toVersion) {
        const registryChanges = (0, breaking_changes_registry_1.getAllChangesForNode)(nodeType, fromVersion, toVersion);
        return registryChanges.map(c => c.propertyName);
    }
}
exports.BreakingChangeDetector = BreakingChangeDetector;
//# sourceMappingURL=breaking-change-detector.js.map