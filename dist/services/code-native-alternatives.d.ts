export type NativeAlternativeKind = 'editFields' | 'filter' | 'sort' | 'removeDuplicates' | 'summarize' | 'aggregate' | 'splitOut' | 'httpRequest';
export interface NativeAlternative {
    kind: NativeAlternativeKind;
    node: string;
    nodeType: string;
    does: string;
    when?: string;
    executeOnce: boolean;
}
export type CodeNodeMode = 'runOnceForAllItems' | 'runOnceForEachItem';
export declare const MAX_CODE_LINES = 20;
export declare const MAX_CODE_CHARS = 5000;
export declare function findNativeAlternative(jsCode: unknown, mode?: unknown): NativeAlternative | undefined;
//# sourceMappingURL=code-native-alternatives.d.ts.map