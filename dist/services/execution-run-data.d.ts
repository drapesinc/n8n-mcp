export type RunDataField = 'data' | 'inputOverride';
export type RunBranch = unknown[] | null;
export declare function extractConnectionBranches(connections: unknown): RunBranch[];
export declare function mergeRunBranches(nodeData: unknown, field?: RunDataField, maxPerBranch?: number): RunBranch[];
export declare function sampleRunItems(nodeData: unknown, maxItems?: number): unknown[];
export declare function countRunItems(nodeData: unknown): number;
export declare function firstRunItem(nodeData: unknown, field?: RunDataField): unknown;
export declare function hasRunOutputData(nodeData: unknown): boolean;
export declare function latestStartTime(nodeData: unknown): number;
export declare function totalExecutionTime(nodeData: unknown): number | undefined;
export declare function getRunError(nodeData: unknown): any;
//# sourceMappingURL=execution-run-data.d.ts.map