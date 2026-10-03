export declare const COMPRESSION_MIN_LENGTH = 1024;
export declare function isCompressedColumn(value: unknown): value is string;
export declare function compressColumnText(text: string): string;
export declare function decompressColumnText(stored: string): string;
export declare function compressColumnJson(value: unknown): string;
export declare function decompressColumnJson(stored: string | null | undefined, fallback: any): any;
//# sourceMappingURL=compressed-column.d.ts.map