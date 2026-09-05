export declare function getDisabledTools(): Set<string>;
export declare function isToolDisabled(toolName: string): boolean;
export declare function getValidOperations(toolName: string): Set<string>;
export declare function getDisabledToolOperations(): Map<string, Set<string>>;
export declare function getDisabledOperations(toolName: string): Set<string>;
export declare function resolveRequestedOperation(toolName: string, args: any): unknown;
export declare function isOperationDisabled(toolName: string, operation: string): boolean;
export declare function resetToolPolicyCache(): void;
//# sourceMappingURL=tool-policy.d.ts.map