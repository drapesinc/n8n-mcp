import { ConfigValidator, ValidationResult } from './config-validator';
import { NodeRepository } from '../database/node-repository';
export type ValidationMode = 'full' | 'operation' | 'minimal';
export type ValidationProfile = 'strict' | 'runtime' | 'ai-friendly' | 'minimal';
export interface EnhancedValidationResult extends ValidationResult {
    mode: ValidationMode;
    profile?: ValidationProfile;
    operation?: {
        resource?: string;
        operation?: string;
        action?: string;
    };
    examples?: Array<{
        description: string;
        config: Record<string, any>;
    }>;
    nextSteps?: string[];
}
export interface OperationContext {
    resource?: string;
    operation?: string;
    action?: string;
    mode?: string;
}
export declare class EnhancedConfigValidator extends ConfigValidator {
    private static operationSimilarityService;
    private static resourceSimilarityService;
    private static nodeRepository;
    static initializeSimilarityServices(repository: NodeRepository): void;
    static validateWithMode(nodeType: string, config: Record<string, any>, properties: any[], mode?: ValidationMode, profile?: ValidationProfile): EnhancedValidationResult;
    private static extractOperationContext;
    private static filterPropertiesByMode;
    private static applyNodeDefaults;
    private static isPropertyRelevantToOperation;
    private static addOperationSpecificEnhancements;
    private static enhanceSlackValidation;
    private static enhanceGoogleSheetsValidation;
    private static enhanceHttpRequestValidation;
    private static generateNextSteps;
    private static deduplicateErrors;
    private static shouldFilterCredentialWarning;
    private static applyProfileFilters;
    private static filterWarningsByProfile;
    private static enforceErrorHandlingForProfile;
    private static addErrorHandlingSuggestions;
    private static validateFixedCollectionStructures;
    private static validateSwitchNodeStructure;
    private static validateIfNodeStructure;
    private static validateFilterNodeStructure;
    private static validateResourceAndOperation;
    private static validateSpecialTypeStructures;
    private static validateComplexTypeStructure;
    private static validateFilterOperations;
}
//# sourceMappingURL=enhanced-config-validator.d.ts.map