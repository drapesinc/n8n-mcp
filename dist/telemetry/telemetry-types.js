"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryErrorType = exports.TELEMETRY_BACKEND = exports.TELEMETRY_CONFIG = void 0;
exports.TELEMETRY_CONFIG = {
    BATCH_FLUSH_INTERVAL: 60000,
    EVENT_QUEUE_THRESHOLD: 10,
    WORKFLOW_QUEUE_THRESHOLD: 5,
    OPERATION_TIMEOUT: 5000,
    FETCH_TIMEOUT_MS: 2000,
    SHUTDOWN_FLUSH_TIMEOUT_MS: 2500,
    RATE_LIMIT_WINDOW: 60000,
    RATE_LIMIT_MAX_EVENTS: 100,
    MAX_QUEUE_SIZE: 1000,
    MAX_BATCH_SIZE: 50,
};
exports.TELEMETRY_BACKEND = {
    URL: 'https://ydyufsohxdfpopqbubwk.supabase.co',
    ANON_KEY: 'sb_publishable_UbVUTyXgIyvemM9b15auQg_YzGa47Gq'
};
var TelemetryErrorType;
(function (TelemetryErrorType) {
    TelemetryErrorType["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    TelemetryErrorType["NETWORK_ERROR"] = "NETWORK_ERROR";
    TelemetryErrorType["RATE_LIMIT_ERROR"] = "RATE_LIMIT_ERROR";
    TelemetryErrorType["QUEUE_OVERFLOW_ERROR"] = "QUEUE_OVERFLOW_ERROR";
    TelemetryErrorType["INITIALIZATION_ERROR"] = "INITIALIZATION_ERROR";
    TelemetryErrorType["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(TelemetryErrorType || (exports.TelemetryErrorType = TelemetryErrorType = {}));
//# sourceMappingURL=telemetry-types.js.map