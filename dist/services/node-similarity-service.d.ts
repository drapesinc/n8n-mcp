import { NodeRepository } from '../database/node-repository';
export interface NodeSuggestion {
    nodeType: string;
    displayName: string;
    confidence: number;
    reason: string;
    category?: string;
    description?: string;
}
export interface SimilarityScore {
    nameSimilarity: number;
    categoryMatch: number;
    packageMatch: number;
    patternMatch: number;
    totalScore: number;
}
export interface CommonMistakePattern {
    pattern: string;
    suggestion: string;
    confidence: number;
    reason: string;
}
export declare class NodeSimilarityService {
    private static readonly SCORING_THRESHOLD;
    private static readonly TYPO_EDIT_DISTANCE;
    private static readonly MIN_CATEGORY_MATCH_LENGTH;
    private static readonly SHORT_SEARCH_LENGTH;
    private static readonly CACHE_DURATION_MS;
    private static readonly AUTO_FIX_CONFIDENCE;
    private repository;
    private commonMistakes;
    private nodeCache;
    private cacheExpiry;
    private cacheVersion;
    constructor(repository: NodeRepository);
    private initializeCommonMistakes;
    private isCommonNodeWithoutPrefix;
    findSimilarNodes(invalidType: string, limit?: number): Promise<NodeSuggestion[]>;
    private checkCommonMistakes;
    private calculateSimilarityScore;
    private createSuggestion;
    private normalizeNodeType;
    private getStringSimilarity;
    private getEditDistance;
    private getCachedNodes;
    invalidateCache(): void;
    refreshCache(): Promise<void>;
    formatSuggestionMessage(suggestions: NodeSuggestion[], invalidType: string): string;
    isAutoFixable(suggestion: NodeSuggestion): boolean;
    clearCache(): void;
}
//# sourceMappingURL=node-similarity-service.d.ts.map