export interface SearchIntent {
    id: string;
    nodeTypes: readonly string[];
    phrases: readonly string[];
}
export declare const SEARCH_INTENTS: readonly SearchIntent[];
export declare function normalizeIntentQuery(query: string): string;
export declare function matchSearchIntent(query: string): SearchIntent | undefined;
//# sourceMappingURL=search-intents.d.ts.map