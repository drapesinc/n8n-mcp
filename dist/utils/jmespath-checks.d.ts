export interface JmespathQueryFinding {
    severity: 'error' | 'warning';
    message: string;
    fix: string;
}
export interface JmespathCall {
    index: number;
    query?: string;
    queryIsFirstArgument: boolean;
}
export declare function blankStringLiterals(source: string, options?: {
    comments?: boolean;
}): string;
export declare function findJmespathCalls(source: string): JmespathCall[];
export declare function checkJmespathQuery(query: string): JmespathQueryFinding[];
//# sourceMappingURL=jmespath-checks.d.ts.map