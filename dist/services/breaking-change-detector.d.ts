import { NodeRepository } from '../database/node-repository';
export interface DetectedChange {
    propertyName: string;
    fromVersion?: string;
    toVersion?: string;
    changeType: 'added' | 'removed' | 'renamed' | 'type_changed' | 'requirement_changed' | 'default_changed';
    isBreaking: boolean;
    oldValue?: any;
    newValue?: any;
    migrationHint: string;
    autoMigratable: boolean;
    migrationStrategy?: any;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    source: 'registry' | 'dynamic';
}
export interface VersionUpgradeAnalysis {
    nodeType: string;
    fromVersion: string;
    toVersion: string;
    hasBreakingChanges: boolean;
    changes: DetectedChange[];
    autoMigratableCount: number;
    manualRequiredCount: number;
    overallSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
    recommendations: string[];
}
export declare class BreakingChangeDetector {
    private nodeRepository;
    constructor(nodeRepository: NodeRepository);
    analyzeVersionUpgrade(nodeType: string, fromVersion: string, toVersion: string): Promise<VersionUpgradeAnalysis>;
    private getRegistryChanges;
    private detectDynamicChanges;
    private flattenProperties;
    private mergeChanges;
    private calculateOverallSeverity;
    private generateRecommendations;
    hasBreakingChanges(nodeType: string, fromVersion: string, toVersion: string): boolean;
    getChangedProperties(nodeType: string, fromVersion: string, toVersion: string): string[];
}
//# sourceMappingURL=breaking-change-detector.d.ts.map