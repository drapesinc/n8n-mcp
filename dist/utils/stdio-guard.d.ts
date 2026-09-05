export interface OriginalConsole {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
    debug: typeof console.debug;
}
export interface StdioGuardOptions {
    silenceConsole?: boolean;
}
export declare function installStdioGuard(options?: StdioGuardOptions): OriginalConsole;
export declare function resetStdioGuardForTests(): void;
//# sourceMappingURL=stdio-guard.d.ts.map