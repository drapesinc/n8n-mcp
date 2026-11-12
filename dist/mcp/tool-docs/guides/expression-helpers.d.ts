export type HelperType = 'Array' | 'String' | 'Object' | 'Number' | 'Date';
export interface HelperExample {
    input: unknown;
    args?: unknown[];
    output: unknown;
}
export interface ExpressionHelper {
    type: HelperType;
    name: string;
    call: string;
    summary: string;
    example?: HelperExample;
}
export declare const EXPRESSION_HELPERS: ExpressionHelper[];
export declare const EXPRESSION_GLOBALS: Array<{
    call: string;
    summary: string;
}>;
export declare function getExpressionHelpersGuide(depth?: 'essentials' | 'full'): string;
//# sourceMappingURL=expression-helpers.d.ts.map