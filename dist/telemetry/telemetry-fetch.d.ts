type TelemetryFetch = typeof globalThis.fetch;
export interface TelemetryFetchOptions {
    baseFetch?: TelemetryFetch;
    timeoutMs?: number;
    setTimeoutFn?: typeof globalThis.setTimeout;
    clearTimeoutFn?: typeof globalThis.clearTimeout;
}
export declare function createTelemetryFetch({ baseFetch, timeoutMs, setTimeoutFn, clearTimeoutFn, }?: TelemetryFetchOptions): TelemetryFetch;
export declare const telemetryFetch: typeof fetch;
export {};
//# sourceMappingURL=telemetry-fetch.d.ts.map