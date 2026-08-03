export declare const CANONICAL_CORE_NODES: readonly string[];
export interface CoreNodeLookup {
    getNode(nodeType: string): unknown;
}
export declare function findMissingCoreNodes(lookup: CoreNodeLookup): string[];
export declare function assertCoreNodesPresent(lookup: CoreNodeLookup): void;
//# sourceMappingURL=core-node-check.d.ts.map