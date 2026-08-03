export declare function getToolDocumentation(toolName: string, depth?: 'essentials' | 'full', disabledOperations?: Set<string>): string;
export declare function getToolsOverview(depth?: 'essentials' | 'full', disabledToolOps?: Map<string, Set<string>>): string;
export declare function searchToolDocumentation(keyword: string): string[];
export declare function getToolsByCategory(category: string): string[];
export declare function getAllCategories(): string[];
//# sourceMappingURL=tools-documentation.d.ts.map