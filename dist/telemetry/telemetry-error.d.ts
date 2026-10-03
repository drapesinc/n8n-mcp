import { TelemetryErrorType, TelemetryErrorContext } from './telemetry-types';
export { TelemetryErrorType, TelemetryErrorContext } from './telemetry-types';
export declare class TelemetryError extends Error {
    readonly type: TelemetryErrorType;
    readonly context?: Record<string, any>;
    readonly timestamp: number;
    readonly retryable: boolean;
    constructor(type: TelemetryErrorType, message: string, context?: Record<string, any>, retryable?: boolean);
    toContext(): TelemetryErrorContext;
    log(): void;
}
export declare class TelemetryCircuitBreaker {
    private failureCount;
    private lastFailureTime;
    private state;
    private readonly failureThreshold;
    private readonly resetTimeout;
    private readonly halfOpenRequests;
    private halfOpenCount;
    constructor(failureThreshold?: number, resetTimeout?: number, halfOpenRequests?: number);
    shouldAllow(): boolean;
    recordSuccess(): void;
    recordFailure(error?: Error): void;
    private canRetryNow;
    getState(): {
        state: string;
        failureCount: number;
        canRetry: boolean;
    };
    reset(): void;
}
export declare class TelemetryErrorAggregator {
    private errors;
    private errorDetails;
    private readonly maxDetails;
    record(error: TelemetryError): void;
    getStats(): {
        totalErrors: number;
        errorsByType: Record<string, number>;
        mostCommonError?: string;
        recentErrors: TelemetryErrorContext[];
    };
    reset(): void;
}
//# sourceMappingURL=telemetry-error.d.ts.map