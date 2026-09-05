export interface GetNodeParams {
    mode?: string;
    detail?: string;
}
export declare function resolveGetNodeAliases(mode?: unknown, detail?: unknown): GetNodeParams;
export declare function suggestExecutionsAction(action: string): string | undefined;
export declare function withWorkflowIdAlias<T extends Record<string, unknown>>(args: T): T;
export declare function hasText(value: unknown): value is string;
//# sourceMappingURL=param-aliases.d.ts.map