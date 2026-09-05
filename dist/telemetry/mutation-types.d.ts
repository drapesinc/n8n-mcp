import { DiffOperation } from '../types/workflow-diff.js';
export declare enum IntentClassification {
    ADD_FUNCTIONALITY = "add_functionality",
    MODIFY_CONFIGURATION = "modify_configuration",
    REWIRE_LOGIC = "rewire_logic",
    FIX_VALIDATION = "fix_validation",
    CLEANUP = "cleanup",
    UNKNOWN = "unknown"
}
export declare enum MutationToolName {
    UPDATE_PARTIAL = "n8n_update_partial_workflow",
    UPDATE_FULL = "n8n_update_full_workflow"
}
export interface ValidationResult {
    valid: boolean;
    errors: Array<{
        type: string;
        message: string;
        severity?: string;
        location?: string;
    }>;
    warnings?: Array<{
        type: string;
        message: string;
    }>;
}
export interface MutationChangeMetrics {
    nodesAdded: number;
    nodesRemoved: number;
    nodesModified: number;
    connectionsAdded: number;
    connectionsRemoved: number;
    propertiesChanged: number;
}
export interface MutationValidationMetrics {
    validationImproved: boolean | null;
    errorsResolved: number;
    errorsIntroduced: number;
}
export interface WorkflowMutationData {
    sessionId: string;
    toolName: MutationToolName;
    userIntent: string;
    operations: DiffOperation[];
    workflowBefore: any;
    workflowAfter: any;
    validationBefore?: ValidationResult;
    validationAfter?: ValidationResult;
    mutationSuccess: boolean;
    mutationError?: string;
    durationMs: number;
}
export interface WorkflowMutationRecord {
    id?: string;
    userId: string;
    sessionId: string;
    workflowAfter: any;
    workflowHashBefore: string;
    workflowHashAfter: string;
    workflowStructureHashBefore?: string;
    workflowStructureHashAfter?: string;
    isTrulySuccessful?: boolean;
    userIntent: string;
    intentClassification: IntentClassification;
    toolName: MutationToolName;
    operations: DiffOperation[];
    operationCount: number;
    operationTypes: string[];
    validationBefore?: ValidationResult;
    validationAfter?: ValidationResult;
    validationImproved: boolean | null;
    errorsResolved: number;
    errorsIntroduced: number;
    nodesAdded: number;
    nodesRemoved: number;
    nodesModified: number;
    connectionsAdded: number;
    connectionsRemoved: number;
    propertiesChanged: number;
    mutationSuccess: boolean;
    mutationError?: string;
    durationMs: number;
    createdAt?: Date;
}
export interface MutationTrackingOptions {
    enabled?: boolean;
    maxWorkflowSizeKb?: number;
    validateQuality?: boolean;
    sanitize?: boolean;
}
export interface MutationTrackingStats {
    totalMutationsTracked: number;
    successfulMutations: number;
    failedMutations: number;
    mutationsWithValidationImprovement: number;
    averageDurationMs: number;
    intentClassificationBreakdown: Record<IntentClassification, number>;
    operationTypeBreakdown: Record<string, number>;
}
export interface MutationDataQualityResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
//# sourceMappingURL=mutation-types.d.ts.map