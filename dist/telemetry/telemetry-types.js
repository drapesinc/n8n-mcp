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
    MAX_BATCH_BYTES_EVENTS: 256 * 1024,
    MAX_BATCH_BYTES_WORKFLOWS: 1024 * 1024,
    MAX_BATCH_BYTES_MUTATIONS: 2 * 1024 * 1024,
};
exports.TELEMETRY_BACKEND = {
    URL: 'https://telemetry.n8n-mcp.com',
    KEY: 'ntk_pub_245fefa7e96617d0e8015056'
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