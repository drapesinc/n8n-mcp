"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.telemetry = exports.TelemetryManager = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const config_manager_1 = require("./config-manager");
const event_tracker_1 = require("./event-tracker");
const batch_processor_1 = require("./batch-processor");
const performance_monitor_1 = require("./performance-monitor");
const telemetry_types_1 = require("./telemetry-types");
const telemetry_error_1 = require("./telemetry-error");
const telemetry_fetch_1 = require("./telemetry-fetch");
const logger_1 = require("../utils/logger");
class TelemetryManager {
    constructor() {
        this.supabase = null;
        this.isInitialized = false;
        if (TelemetryManager.instance) {
            throw new Error('Use TelemetryManager.getInstance() instead of new TelemetryManager()');
        }
        this.configManager = config_manager_1.TelemetryConfigManager.getInstance();
        this.errorAggregator = new telemetry_error_1.TelemetryErrorAggregator();
        this.performanceMonitor = new performance_monitor_1.TelemetryPerformanceMonitor();
        this.eventTracker = new event_tracker_1.TelemetryEventTracker(() => this.configManager.getUserId(), () => this.isEnabled());
        this.batchProcessor = new batch_processor_1.TelemetryBatchProcessor(null, () => this.isEnabled());
    }
    static getInstance() {
        if (!TelemetryManager.instance) {
            TelemetryManager.instance = new TelemetryManager();
        }
        return TelemetryManager.instance;
    }
    ensureInitialized() {
        if (!this.isInitialized && this.configManager.isEnabled()) {
            this.initialize();
        }
    }
    initialize() {
        if (!this.configManager.isEnabled()) {
            logger_1.logger.debug('Telemetry disabled by user preference');
            return;
        }
        const supabaseUrl = process.env.SUPABASE_URL || telemetry_types_1.TELEMETRY_BACKEND.URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || telemetry_types_1.TELEMETRY_BACKEND.ANON_KEY;
        try {
            this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                },
                realtime: {
                    params: {
                        eventsPerSecond: 1,
                    },
                },
                global: {
                    fetch: telemetry_fetch_1.telemetryFetch,
                },
            });
            this.batchProcessor = new batch_processor_1.TelemetryBatchProcessor(this.supabase, () => this.isEnabled(), {
                onFlushRequested: () => this.flush(),
            });
            this.isInitialized = true;
            this.batchProcessor.start();
            logger_1.logger.debug('Telemetry initialized successfully');
        }
        catch (error) {
            const telemetryError = new telemetry_error_1.TelemetryError(telemetry_error_1.TelemetryErrorType.INITIALIZATION_ERROR, 'Failed to initialize telemetry', { error: error instanceof Error ? error.message : String(error) });
            this.errorAggregator.record(telemetryError);
            telemetryError.log();
            this.isInitialized = false;
        }
    }
    trackToolUsage(toolName, success, duration) {
        this.ensureInitialized();
        this.performanceMonitor.startOperation('trackToolUsage');
        this.eventTracker.trackToolUsage(toolName, success, duration);
        this.eventTracker.updateToolSequence(toolName);
        this.performanceMonitor.endOperation('trackToolUsage');
    }
    async trackWorkflowCreation(workflow, validationPassed) {
        this.ensureInitialized();
        this.performanceMonitor.startOperation('trackWorkflowCreation');
        try {
            await this.eventTracker.trackWorkflowCreation(workflow, validationPassed);
            await this.flush();
        }
        catch (error) {
            const telemetryError = error instanceof telemetry_error_1.TelemetryError
                ? error
                : new telemetry_error_1.TelemetryError(telemetry_error_1.TelemetryErrorType.UNKNOWN_ERROR, 'Failed to track workflow', { error: String(error) });
            this.errorAggregator.record(telemetryError);
        }
        finally {
            this.performanceMonitor.endOperation('trackWorkflowCreation');
        }
    }
    async trackWorkflowMutation(data) {
        this.ensureInitialized();
        if (!this.isEnabled()) {
            logger_1.logger.debug('Telemetry disabled, skipping mutation tracking');
            return;
        }
        this.performanceMonitor.startOperation('trackWorkflowMutation');
        try {
            const { mutationTracker } = await Promise.resolve().then(() => __importStar(require('./mutation-tracker.js')));
            const userId = this.configManager.getUserId();
            const mutationRecord = await mutationTracker.processMutation(data, userId);
            if (mutationRecord) {
                this.eventTracker.enqueueMutation(mutationRecord);
                const queueSize = this.eventTracker.getMutationQueueSize();
                if (queueSize >= 2) {
                    await this.flushMutations();
                }
            }
        }
        catch (error) {
            const telemetryError = error instanceof telemetry_error_1.TelemetryError
                ? error
                : new telemetry_error_1.TelemetryError(telemetry_error_1.TelemetryErrorType.UNKNOWN_ERROR, 'Failed to track workflow mutation', { error: String(error) });
            this.errorAggregator.record(telemetryError);
            logger_1.logger.debug('Error tracking workflow mutation:', error);
        }
        finally {
            this.performanceMonitor.endOperation('trackWorkflowMutation');
        }
    }
    trackError(errorType, context, toolName, errorMessage) {
        this.ensureInitialized();
        this.eventTracker.trackError(errorType, context, toolName, errorMessage);
    }
    trackEvent(eventName, properties) {
        this.ensureInitialized();
        this.eventTracker.trackEvent(eventName, properties);
    }
    trackSessionStart() {
        this.ensureInitialized();
        this.eventTracker.trackSessionStart();
    }
    trackSearchQuery(query, resultsFound, searchType) {
        this.eventTracker.trackSearchQuery(query, resultsFound, searchType);
    }
    trackValidationDetails(nodeType, errorType, details) {
        this.eventTracker.trackValidationDetails(nodeType, errorType, details);
    }
    trackToolSequence(previousTool, currentTool, timeDelta) {
        this.eventTracker.trackToolSequence(previousTool, currentTool, timeDelta);
    }
    trackNodeConfiguration(nodeType, propertiesSet, usedDefaults) {
        this.eventTracker.trackNodeConfiguration(nodeType, propertiesSet, usedDefaults);
    }
    trackPerformanceMetric(operation, duration, metadata) {
        this.eventTracker.trackPerformanceMetric(operation, duration, metadata);
    }
    async flush() {
        this.ensureInitialized();
        if (!this.isEnabled() || !this.supabase)
            return;
        this.performanceMonitor.startOperation('flush');
        const events = this.eventTracker.getEventQueue();
        const workflows = this.eventTracker.getWorkflowQueue();
        const mutations = this.eventTracker.getMutationQueue();
        this.eventTracker.clearEventQueue();
        this.eventTracker.clearWorkflowQueue();
        this.eventTracker.clearMutationQueue();
        try {
            await this.batchProcessor.flush(events, workflows, mutations);
        }
        catch (error) {
            const telemetryError = error instanceof telemetry_error_1.TelemetryError
                ? error
                : new telemetry_error_1.TelemetryError(telemetry_error_1.TelemetryErrorType.NETWORK_ERROR, 'Failed to flush telemetry', { error: String(error) }, true);
            this.errorAggregator.record(telemetryError);
            telemetryError.log();
        }
        finally {
            const duration = this.performanceMonitor.endOperation('flush');
            if (duration > 100) {
                logger_1.logger.debug(`Telemetry flush took ${duration.toFixed(2)}ms`);
            }
        }
    }
    async flushBeforeExit(timeoutMs = telemetry_types_1.TELEMETRY_CONFIG.SHUTDOWN_FLUSH_TIMEOUT_MS) {
        if (!this.isInitialized || !this.configManager.isEnabled())
            return;
        let timer;
        try {
            const deadline = new Promise(resolve => {
                timer = setTimeout(resolve, timeoutMs);
                timer.unref?.();
            });
            await Promise.race([this.flush(), deadline]);
        }
        catch (error) {
            logger_1.logger.debug('Telemetry flush before exit failed:', error);
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
    }
    async flushMutations() {
        this.ensureInitialized();
        if (!this.isEnabled() || !this.supabase)
            return;
        const mutations = this.eventTracker.getMutationQueue();
        this.eventTracker.clearMutationQueue();
        if (mutations.length > 0) {
            await this.batchProcessor.flush([], [], mutations);
        }
    }
    isEnabled() {
        return this.isInitialized && this.configManager.isEnabled();
    }
    disable() {
        this.configManager.disable();
        this.batchProcessor.stop();
        this.isInitialized = false;
        this.supabase = null;
    }
    enable() {
        this.configManager.enable();
        this.initialize();
    }
    getStatus() {
        return this.configManager.getStatus();
    }
    getMetrics() {
        return {
            status: this.isEnabled() ? 'enabled' : 'disabled',
            initialized: this.isInitialized,
            tracking: this.eventTracker.getStats(),
            processing: this.batchProcessor.getMetrics(),
            errors: this.errorAggregator.getStats(),
            performance: this.performanceMonitor.getDetailedReport(),
            overhead: this.performanceMonitor.getTelemetryOverhead()
        };
    }
    static resetInstance() {
        TelemetryManager.instance = undefined;
        global.__telemetryManager = undefined;
    }
}
exports.TelemetryManager = TelemetryManager;
const globalAny = global;
if (!globalAny.__telemetryManager) {
    globalAny.__telemetryManager = TelemetryManager.getInstance();
}
exports.telemetry = globalAny.__telemetryManager;
//# sourceMappingURL=telemetry-manager.js.map