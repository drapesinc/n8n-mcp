import { StartupCheckpoint } from './startup-checkpoints';
export declare class EarlyErrorLogger {
    private static instance;
    private enabled;
    private ingestClient;
    private userId;
    private checkpoints;
    private startTime;
    private initPromise;
    private constructor();
    static getInstance(): EarlyErrorLogger;
    private initialize;
    waitForInit(): Promise<void>;
    logCheckpoint(checkpoint: StartupCheckpoint): void;
    logStartupError(checkpoint: StartupCheckpoint, error: unknown): void;
    private logStartupErrorAsync;
    logStartupSuccess(checkpoints: StartupCheckpoint[], durationMs: number): void;
    getCheckpoints(): StartupCheckpoint[];
    getStartupDuration(): number;
    getStartupData(): {
        durationMs: number;
        checkpoints: StartupCheckpoint[];
    } | null;
    isEnabled(): boolean;
}
//# sourceMappingURL=early-error-logger.d.ts.map