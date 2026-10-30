interface NodeDeprecationInfo {
    nodeType: string;
    version?: string | null;
    deprecatedVersions?: string[];
}
export declare function isDeprecatedNodeVersion(nodeInfo: NodeDeprecationInfo, typeVersion?: unknown): boolean;
export declare function deprecatedNodeReplacementHint(nodeType: string): string;
export declare function deprecatedNodeMessage(workflowNodeType: string): string;
export {};
//# sourceMappingURL=deprecated-nodes.d.ts.map