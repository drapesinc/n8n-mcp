import { NodeRepository } from '../database/node-repository';
export interface OperationSuggestion {
    value: string;
    confidence: number;
    reason: string;
    resource?: string;
    description?: string;
}
export declare class OperationSimilarityService {
    private static readonly CACHE_DURATION_MS;
    private static readonly MIN_CONFIDENCE;
    private static readonly MAX_SUGGESTIONS;
    private static readonly MAX_NAME_LENGTH;
    private static readonly MAX_CACHE_KEY_LENGTH;
    private static readonly MAX_OPERATION_CACHE_ENTRIES;
    private static readonly MAX_SUGGESTION_CACHE_ENTRIES;
    private static readonly CONFIDENCE_THRESHOLDS;
    private repository;
    private operationCache;
    private suggestionCache;
    private commonPatterns;
    constructor(repository: NodeRepository);
    private cleanupExpiredEntries;
    private static setBounded;
    private initializeCommonPatterns;
    findSimilarOperations(nodeType: string, invalidOperation: string, resource?: string, maxSuggestions?: number): OperationSuggestion[];
    private getOperationValue;
    private getResourceValue;
    private getNodeOperations;
    private getNodePatterns;
    private calculateSimilarity;
    private levenshteinDistance;
    private areCommonVariations;
    private getSimilarityReason;
    clearCache(): void;
}
//# sourceMappingURL=operation-similarity-service.d.ts.map