"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telemetryFetch = void 0;
exports.createTelemetryFetch = createTelemetryFetch;
const telemetry_types_1 = require("./telemetry-types");
function abortReason(signal) {
    return signal.reason ?? new DOMException('The operation was aborted', 'AbortError');
}
function createTelemetryFetch({ baseFetch = globalThis.fetch, timeoutMs = telemetry_types_1.TELEMETRY_CONFIG.FETCH_TIMEOUT_MS, setTimeoutFn = globalThis.setTimeout, clearTimeoutFn = globalThis.clearTimeout, } = {}) {
    return (input, init) => {
        const controller = new AbortController();
        const upstreamSignal = init?.signal
            ?? (typeof Request !== 'undefined' && input instanceof Request
                ? input.signal
                : undefined);
        let rejectAbort;
        const abortPromise = new Promise((_, reject) => {
            rejectAbort = reject;
        });
        const abort = (reason) => {
            if (!controller.signal.aborted) {
                controller.abort(reason);
            }
            rejectAbort(reason);
        };
        const handleUpstreamAbort = () => {
            if (upstreamSignal) {
                abort(abortReason(upstreamSignal));
            }
        };
        if (upstreamSignal?.aborted) {
            handleUpstreamAbort();
        }
        else {
            upstreamSignal?.addEventListener('abort', handleUpstreamAbort, { once: true });
        }
        const timer = setTimeoutFn(() => {
            abort(new DOMException(`Telemetry fetch timed out after ${timeoutMs}ms`, 'TimeoutError'));
        }, timeoutMs);
        timer.unref?.();
        const fetchPromise = Promise.resolve().then(() => baseFetch(input, {
            ...init,
            signal: controller.signal,
        }));
        return Promise.race([fetchPromise, abortPromise]).finally(() => {
            clearTimeoutFn(timer);
            upstreamSignal?.removeEventListener('abort', handleUpstreamAbort);
        });
    };
}
exports.telemetryFetch = createTelemetryFetch();
//# sourceMappingURL=telemetry-fetch.js.map