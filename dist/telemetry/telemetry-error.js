"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryErrorAggregator = exports.TelemetryCircuitBreaker = exports.TelemetryError = exports.TelemetryErrorType = void 0;
const logger_1 = require("../utils/logger");
var telemetry_types_1 = require("./telemetry-types");
Object.defineProperty(exports, "TelemetryErrorType", { enumerable: true, get: function () { return telemetry_types_1.TelemetryErrorType; } });
class TelemetryError extends Error {
    constructor(type, message, context, retryable = false) {
        super(message);
        this.name = 'TelemetryError';
        this.type = type;
        this.context = context;
        this.timestamp = Date.now();
        this.retryable = retryable;
        Object.setPrototypeOf(this, TelemetryError.prototype);
    }
    toContext() {
        return {
            type: this.type,
            message: this.message,
            context: this.context,
            timestamp: this.timestamp,
            retryable: this.retryable
        };
    }
    log() {
        const logContext = {
            type: this.type,
            message: this.message,
            ...this.context
        };
        if (this.retryable) {
            logger_1.logger.debug('Retryable telemetry error:', logContext);
        }
        else {
            logger_1.logger.debug('Non-retryable telemetry error:', logContext);
        }
    }
}
exports.TelemetryError = TelemetryError;
class TelemetryCircuitBreaker {
    constructor(failureThreshold = 5, resetTimeout = 60000, halfOpenRequests = 3) {
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.state = 'closed';
        this.halfOpenCount = 0;
        this.failureThreshold = failureThreshold;
        this.resetTimeout = resetTimeout;
        this.halfOpenRequests = halfOpenRequests;
    }
    shouldAllow() {
        const now = Date.now();
        switch (this.state) {
            case 'closed':
                return true;
            case 'open':
                if (now - this.lastFailureTime > this.resetTimeout) {
                    this.state = 'half-open';
                    this.halfOpenCount = 0;
                    logger_1.logger.debug('Circuit breaker transitioning to half-open');
                    return true;
                }
                return false;
            case 'half-open':
                if (this.halfOpenCount < this.halfOpenRequests) {
                    this.halfOpenCount++;
                    return true;
                }
                return false;
            default:
                return false;
        }
    }
    recordSuccess() {
        if (this.state === 'half-open') {
            if (this.halfOpenCount >= this.halfOpenRequests) {
                this.state = 'closed';
                this.failureCount = 0;
                logger_1.logger.debug('Circuit breaker closed after successful recovery');
            }
        }
        else if (this.state === 'closed') {
            this.failureCount = 0;
        }
    }
    recordFailure(error) {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.state === 'half-open') {
            this.state = 'open';
            logger_1.logger.debug('Circuit breaker opened from half-open state', { error: error?.message });
        }
        else if (this.state === 'closed' && this.failureCount >= this.failureThreshold) {
            this.state = 'open';
            logger_1.logger.debug(`Circuit breaker opened after ${this.failureCount} failures`, { error: error?.message });
        }
    }
    canRetryNow() {
        switch (this.state) {
            case 'closed':
                return true;
            case 'open':
                return Date.now() - this.lastFailureTime > this.resetTimeout;
            case 'half-open':
                return this.halfOpenCount < this.halfOpenRequests;
            default:
                return false;
        }
    }
    getState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            canRetry: this.canRetryNow()
        };
    }
    reset() {
        this.state = 'closed';
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.halfOpenCount = 0;
    }
}
exports.TelemetryCircuitBreaker = TelemetryCircuitBreaker;
class TelemetryErrorAggregator {
    constructor() {
        this.errors = new Map();
        this.errorDetails = [];
        this.maxDetails = 100;
    }
    record(error) {
        const count = this.errors.get(error.type) || 0;
        this.errors.set(error.type, count + 1);
        this.errorDetails.push(error.toContext());
        if (this.errorDetails.length > this.maxDetails) {
            this.errorDetails.shift();
        }
    }
    getStats() {
        const errorsByType = {};
        let totalErrors = 0;
        let mostCommonError;
        let maxCount = 0;
        for (const [type, count] of this.errors.entries()) {
            errorsByType[type] = count;
            totalErrors += count;
            if (count > maxCount) {
                maxCount = count;
                mostCommonError = type;
            }
        }
        return {
            totalErrors,
            errorsByType,
            mostCommonError,
            recentErrors: this.errorDetails.slice(-10)
        };
    }
    reset() {
        this.errors.clear();
        this.errorDetails = [];
    }
}
exports.TelemetryErrorAggregator = TelemetryErrorAggregator;
//# sourceMappingURL=telemetry-error.js.map