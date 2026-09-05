"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryBatchProcessor = void 0;
const telemetry_types_1 = require("./telemetry-types");
const telemetry_error_1 = require("./telemetry-error");
const logger_1 = require("../utils/logger");
function keyToSnakeCase(key) {
    return key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
function mutationToSupabaseFormat(mutation) {
    const result = {};
    for (const [key, value] of Object.entries(mutation)) {
        result[keyToSnakeCase(key)] = value;
    }
    return result;
}
class TelemetryBatchProcessor {
    constructor(supabase, isEnabled, options = {}) {
        this.supabase = supabase;
        this.isEnabled = isEnabled;
        this.flushQueue = Promise.resolve();
        this.metrics = {
            eventsTracked: 0,
            eventsDropped: 0,
            eventsFailed: 0,
            batchesSent: 0,
            batchesFailed: 0,
            averageFlushTime: 0,
            rateLimitHits: 0
        };
        this.flushTimes = [];
        this.deadLetterQueue = [];
        this.maxDeadLetterSize = 100;
        this.eventListeners = {};
        this.started = false;
        this.circuitBreaker = new telemetry_error_1.TelemetryCircuitBreaker();
        this.operationTimeout = options.operationTimeout ?? telemetry_types_1.TELEMETRY_CONFIG.OPERATION_TIMEOUT;
        this.onFlushRequested = options.onFlushRequested;
    }
    start() {
        if (!this.isEnabled() || !this.supabase)
            return;
        if (this.started) {
            logger_1.logger.debug('Telemetry batch processor already started, skipping');
            return;
        }
        this.flushTimer = setInterval(() => {
            void this.requestFlush();
        }, telemetry_types_1.TELEMETRY_CONFIG.BATCH_FLUSH_INTERVAL);
        if (typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
            this.flushTimer.unref();
        }
        this.eventListeners.beforeExit = () => {
            void this.requestFlush();
        };
        this.eventListeners.sigint = () => {
            void this.flushAndExit();
        };
        this.eventListeners.sigterm = () => {
            void this.flushAndExit();
        };
        process.on('beforeExit', this.eventListeners.beforeExit);
        process.on('SIGINT', this.eventListeners.sigint);
        process.on('SIGTERM', this.eventListeners.sigterm);
        this.started = true;
        logger_1.logger.debug('Telemetry batch processor started');
    }
    stop() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = undefined;
        }
        if (this.eventListeners.beforeExit) {
            process.removeListener('beforeExit', this.eventListeners.beforeExit);
        }
        if (this.eventListeners.sigint) {
            process.removeListener('SIGINT', this.eventListeners.sigint);
        }
        if (this.eventListeners.sigterm) {
            process.removeListener('SIGTERM', this.eventListeners.sigterm);
        }
        this.eventListeners = {};
        this.started = false;
        logger_1.logger.debug('Telemetry batch processor stopped');
    }
    requestFlush() {
        const requestedFlush = this.onFlushRequested
            ? this.onFlushRequested()
            : this.flush();
        return Promise.resolve(requestedFlush).catch(error => {
            logger_1.logger.debug('Scheduled telemetry flush failed:', error);
        });
    }
    async flushAndExit() {
        await this.requestFlush();
        process.exit(0);
    }
    flush(events, workflows, mutations) {
        const queuedEvents = events ? [...events] : undefined;
        const queuedWorkflows = workflows ? [...workflows] : undefined;
        const queuedMutations = mutations ? [...mutations] : undefined;
        const queuedFlush = this.flushQueue.then(() => this.flushQueuedBatch(queuedEvents, queuedWorkflows, queuedMutations));
        this.flushQueue = queuedFlush.catch(() => undefined);
        return queuedFlush;
    }
    async flushQueuedBatch(events, workflows, mutations) {
        if (!this.isEnabled() || !this.supabase)
            return;
        if (!this.circuitBreaker.shouldAllow()) {
            logger_1.logger.debug('Circuit breaker open - skipping flush');
            this.metrics.eventsDropped += (events?.length || 0) + (workflows?.length || 0) + (mutations?.length || 0);
            return;
        }
        const startTime = Date.now();
        let hasErrors = false;
        if (events && events.length > 0) {
            hasErrors = !(await this.flushEvents(events)) || hasErrors;
        }
        if (workflows && workflows.length > 0) {
            hasErrors = !(await this.flushWorkflows(workflows)) || hasErrors;
        }
        if (mutations && mutations.length > 0) {
            hasErrors = !(await this.flushMutations(mutations)) || hasErrors;
        }
        const flushTime = Date.now() - startTime;
        this.recordFlushTime(flushTime);
        if (hasErrors) {
            this.circuitBreaker.recordFailure();
        }
        else {
            this.circuitBreaker.recordSuccess();
        }
        if (!hasErrors && this.deadLetterQueue.length > 0) {
            await this.processDeadLetterQueue();
        }
    }
    async flushEvents(events) {
        try {
            const batches = this.createBatches(events, telemetry_types_1.TELEMETRY_CONFIG.MAX_BATCH_SIZE);
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                const result = await this.executeWithTimeout(async () => {
                    const { error } = await this.supabase
                        .from('telemetry_events')
                        .insert(batch);
                    if (error) {
                        throw error;
                    }
                    logger_1.logger.debug(`Flushed batch of ${batch.length} telemetry events`);
                    return true;
                }, 'Flush telemetry events');
                if (result) {
                    this.metrics.eventsTracked += batch.length;
                    this.metrics.batchesSent++;
                }
                else {
                    const unsent = this.addUnsentBatchesToDeadLetterQueue(batches, batchIndex);
                    this.metrics.eventsFailed += unsent.itemCount;
                    this.metrics.batchesFailed += unsent.batchCount;
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            logger_1.logger.debug('Failed to flush events:', error);
            throw new telemetry_error_1.TelemetryError(telemetry_error_1.TelemetryErrorType.NETWORK_ERROR, 'Failed to flush events', { error: error instanceof Error ? error.message : String(error) }, true);
        }
    }
    async flushWorkflows(workflows) {
        try {
            const uniqueWorkflows = this.deduplicateWorkflows(workflows);
            logger_1.logger.debug(`Deduplicating workflows: ${workflows.length} -> ${uniqueWorkflows.length}`);
            const batches = this.createBatches(uniqueWorkflows, telemetry_types_1.TELEMETRY_CONFIG.MAX_BATCH_SIZE);
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                const result = await this.executeWithTimeout(async () => {
                    const { error } = await this.supabase
                        .from('telemetry_workflows')
                        .insert(batch);
                    if (error) {
                        throw error;
                    }
                    logger_1.logger.debug(`Flushed batch of ${batch.length} telemetry workflows`);
                    return true;
                }, 'Flush telemetry workflows');
                if (result) {
                    this.metrics.eventsTracked += batch.length;
                    this.metrics.batchesSent++;
                }
                else {
                    const unsent = this.addUnsentBatchesToDeadLetterQueue(batches, batchIndex);
                    this.metrics.eventsFailed += unsent.itemCount;
                    this.metrics.batchesFailed += unsent.batchCount;
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            logger_1.logger.debug('Failed to flush workflows:', error);
            throw new telemetry_error_1.TelemetryError(telemetry_error_1.TelemetryErrorType.NETWORK_ERROR, 'Failed to flush workflows', { error: error instanceof Error ? error.message : String(error) }, true);
        }
    }
    async flushMutations(mutations) {
        try {
            const batches = this.createBatches(mutations, telemetry_types_1.TELEMETRY_CONFIG.MAX_BATCH_SIZE);
            let allBatchesSent = true;
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                const result = await this.executeWithTimeout(async () => {
                    const snakeCaseBatch = batch.map(mutation => mutationToSupabaseFormat(mutation));
                    const { error } = await this.supabase
                        .from('workflow_mutations')
                        .insert(snakeCaseBatch);
                    if (error) {
                        logger_1.logger.error('Mutation insert error details:', {
                            code: error.code,
                            message: error.message,
                            details: error.details,
                            hint: error.hint,
                            fullError: String(error)
                        });
                        throw error;
                    }
                    logger_1.logger.debug(`Flushed batch of ${batch.length} workflow mutations`);
                    return true;
                }, 'Flush workflow mutations');
                if (result) {
                    this.metrics.eventsTracked += batch.length;
                    this.metrics.batchesSent++;
                }
                else {
                    this.metrics.eventsFailed += batch.length;
                    this.metrics.eventsDropped += batch.length;
                    this.metrics.batchesFailed++;
                    allBatchesSent = false;
                }
            }
            return allBatchesSent;
        }
        catch (error) {
            logger_1.logger.error('Failed to flush mutations with details:', {
                errorMsg: error instanceof Error ? error.message : String(error),
                errorType: error instanceof Error ? error.constructor.name : typeof error
            });
            throw new telemetry_error_1.TelemetryError(telemetry_error_1.TelemetryErrorType.NETWORK_ERROR, 'Failed to flush workflow mutations', { error: error instanceof Error ? error.message : String(error) }, true);
        }
    }
    async executeWithTimeout(operation, operationName) {
        let timeout;
        let result;
        try {
            const timeoutPromise = new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new Error('Operation timed out')), this.operationTimeout);
                if (typeof timeout === 'object' && timeout !== null && 'unref' in timeout) {
                    timeout.unref();
                }
            });
            result = await Promise.race([operation(), timeoutPromise]);
        }
        catch (error) {
            logger_1.logger.debug(`${operationName} failed:`, error);
            result = null;
        }
        if (timeout !== undefined) {
            clearTimeout(timeout);
        }
        return result;
    }
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
    deduplicateWorkflows(workflows) {
        const seen = new Set();
        const unique = [];
        for (const workflow of workflows) {
            if (!seen.has(workflow.workflow_hash)) {
                seen.add(workflow.workflow_hash);
                unique.push(workflow);
            }
        }
        return unique;
    }
    addUnsentBatchesToDeadLetterQueue(batches, failedBatchIndex) {
        const unsentBatches = batches.slice(failedBatchIndex);
        const unsentItems = unsentBatches.flat();
        this.addToDeadLetterQueue(unsentItems);
        return {
            itemCount: unsentItems.length,
            batchCount: unsentBatches.length,
        };
    }
    addToDeadLetterQueue(items) {
        for (const item of items) {
            this.deadLetterQueue.push(item);
            if (this.deadLetterQueue.length > this.maxDeadLetterSize) {
                const dropped = this.deadLetterQueue.shift();
                if (dropped) {
                    this.metrics.eventsDropped++;
                }
            }
        }
        logger_1.logger.debug(`Added ${items.length} items to dead letter queue`);
    }
    async processDeadLetterQueue() {
        if (this.deadLetterQueue.length === 0)
            return;
        logger_1.logger.debug(`Processing ${this.deadLetterQueue.length} items from dead letter queue`);
        const events = [];
        const workflows = [];
        for (const item of this.deadLetterQueue) {
            if ('workflow_hash' in item) {
                workflows.push(item);
            }
            else {
                events.push(item);
            }
        }
        this.deadLetterQueue = [];
        if (events.length > 0) {
            await this.flushEvents(events);
        }
        if (workflows.length > 0) {
            await this.flushWorkflows(workflows);
        }
    }
    recordFlushTime(time) {
        this.flushTimes.push(time);
        if (this.flushTimes.length > 100) {
            this.flushTimes.shift();
        }
        const sum = this.flushTimes.reduce((a, b) => a + b, 0);
        this.metrics.averageFlushTime = Math.round(sum / this.flushTimes.length);
        this.metrics.lastFlushTime = time;
    }
    getMetrics() {
        return {
            ...this.metrics,
            circuitBreakerState: this.circuitBreaker.getState(),
            deadLetterQueueSize: this.deadLetterQueue.length
        };
    }
    resetMetrics() {
        this.metrics = {
            eventsTracked: 0,
            eventsDropped: 0,
            eventsFailed: 0,
            batchesSent: 0,
            batchesFailed: 0,
            averageFlushTime: 0,
            rateLimitHits: 0
        };
        this.flushTimes = [];
        this.circuitBreaker.reset();
    }
}
exports.TelemetryBatchProcessor = TelemetryBatchProcessor;
//# sourceMappingURL=batch-processor.js.map