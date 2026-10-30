import { NodeRepository } from '../database/node-repository';
export interface ResourceSuggestion {
    value: string;
    confidence: number;
    reason: string;
    availableOperations?: string[];
}
export declare class ResourceSimilarityService {
    private static readonly CACHE_DURATION_MS;
    private static readonly MIN_CONFIDENCE;
    private static readonly MAX_SUGGESTIONS;
    private static readonly MAX_NAME_LENGTH;
    private static readonly MAX_CACHE_KEY_LENGTH;
    private static readonly MAX_RESOURCE_CACHE_ENTRIES;
    private static readonly MAX_SUGGESTION_CACHE_ENTRIES;
    private static readonly CONFIDENCE_THRESHOLDS;
    private repository;
    private resourceCache;
    private suggestionCache;
    private commonPatterns;
    constructor(repository: NodeRepository);
    private cleanupExpiredEntries;
    private static setBounded;
    private initializeCommonPatterns;
    findSimilarResources(nodeType: string, invalidResource: string, maxSuggestions?: number): ResourceSuggestion[];
    private getResourceValue;
    private getNodeResources;
    private extractImplicitResources;
    private inferResourceFromOperations;
    private getNodePatterns;
    private toSingular;
    private toPlural;
    private calculateSimilarity;
    private levenshteinDistance;
    private getSimilarityReason;
    clearCache(): void;
}
//# sourceMappingURL=resource-similarity-service.d.ts.map