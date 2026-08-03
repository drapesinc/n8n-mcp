"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EarlyErrorLogger = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const config_manager_1 = require("./config-manager");
const telemetry_types_1 = require("./telemetry-types");
const startup_checkpoints_1 = require("./startup-checkpoints");
const error_sanitization_utils_1 = require("./error-sanitization-utils");
const telemetry_fetch_1 = require("./telemetry-fetch");
const logger_1 = require("../utils/logger");
async function withTimeout(promise, timeoutMs, operation) {
    let timer;
    try {
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs);
            timer.unref?.();
        });
        return await Promise.race([promise, timeoutPromise]);
    }
    catch (error) {
        logger_1.logger.debug(`${operation} failed or timed out:`, error);
        return null;
    }
    finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}
class EarlyErrorLogger {
    constructor() {
        this.enabled = false;
        this.supabase = null;
        this.userId = null;
        this.checkpoints = [];
        this.startTime = Date.now();
        this.initPromise = this.initialize();
    }
    static getInstance() {
        if (!EarlyErrorLogger.instance) {
            EarlyErrorLogger.instance = new EarlyErrorLogger();
        }
        return EarlyErrorLogger.instance;
    }
    async initialize() {
        try {
            if (!telemetry_types_1.TELEMETRY_BACKEND.URL || !telemetry_types_1.TELEMETRY_BACKEND.ANON_KEY) {
                logger_1.logger.debug('Telemetry backend not configured, early error logger disabled');
                this.enabled = false;
                return;
            }
            const configManager = config_manager_1.TelemetryConfigManager.getInstance();
            const isEnabled = configManager.isEnabled();
            if (!isEnabled) {
                logger_1.logger.debug('Telemetry disabled by user, early error logger will not send events');
                this.enabled = false;
                return;
            }
            this.supabase = (0, supabase_js_1.createClient)(telemetry_types_1.TELEMETRY_BACKEND.URL, telemetry_types_1.TELEMETRY_BACKEND.ANON_KEY, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                },
                global: {
                    fetch: telemetry_fetch_1.telemetryFetch,
                },
            });
            this.userId = configManager.getUserId();
            this.enabled = true;
            logger_1.logger.debug('Early error logger initialized successfully');
        }
        catch (error) {
            logger_1.logger.debug('Early error logger initialization failed:', error);
            this.enabled = false;
            this.supabase = null;
            this.userId = null;
        }
    }
    async waitForInit() {
        await this.initPromise;
    }
    logCheckpoint(checkpoint) {
        if (!this.enabled) {
            return;
        }
        try {
            if (!(0, startup_checkpoints_1.isValidCheckpoint)(checkpoint)) {
                logger_1.logger.warn(`Invalid checkpoint: ${checkpoint}`);
                return;
            }
            this.checkpoints.push(checkpoint);
            logger_1.logger.debug(`Checkpoint passed: ${checkpoint} (${(0, startup_checkpoints_1.getCheckpointDescription)(checkpoint)})`);
        }
        catch (error) {
            logger_1.logger.debug('Failed to log checkpoint:', error);
        }
    }
    logStartupError(checkpoint, error) {
        if (!this.enabled || !this.supabase || !this.userId) {
            return;
        }
        this.logStartupErrorAsync(checkpoint, error).catch((logError) => {
            logger_1.logger.debug('Failed to log startup error:', logError);
        });
    }
    async logStartupErrorAsync(checkpoint, error) {
        try {
            let errorMessage = 'Unknown error';
            if (error instanceof Error) {
                errorMessage = error.message;
                if (error.stack) {
                    errorMessage = error.stack;
                }
            }
            else if (typeof error === 'string') {
                errorMessage = error;
            }
            else {
                errorMessage = String(error);
            }
            const sanitizedError = (0, error_sanitization_utils_1.sanitizeErrorMessageCore)(errorMessage);
            let errorType = 'unknown';
            if (error instanceof Error) {
                errorType = error.name || 'Error';
            }
            else if (typeof error === 'string') {
                errorType = 'string_error';
            }
            const event = {
                user_id: this.userId,
                event: 'startup_error',
                properties: {
                    checkpoint,
                    errorMessage: sanitizedError,
                    errorType,
                    checkpointsPassed: this.checkpoints,
                    checkpointsPassedCount: this.checkpoints.length,
                    startupDuration: Date.now() - this.startTime,
                    platform: process.platform,
                    arch: process.arch,
                    nodeVersion: process.version,
                    isDocker: process.env.IS_DOCKER === 'true',
                },
                created_at: new Date().toISOString(),
            };
            const insertOperation = async () => {
                return await this.supabase
                    .from('events')
                    .insert(event)
                    .select()
                    .single();
            };
            const result = await withTimeout(insertOperation(), 5000, 'Startup error insert');
            if (result && 'error' in result && result.error) {
                logger_1.logger.debug('Failed to insert startup error event:', result.error);
            }
            else if (result) {
                logger_1.logger.debug(`Startup error logged for checkpoint: ${checkpoint}`);
            }
        }
        catch (logError) {
            logger_1.logger.debug('Failed to log startup error:', logError);
        }
    }
    logStartupSuccess(checkpoints, durationMs) {
        if (!this.enabled) {
            return;
        }
        try {
            this.checkpoints = checkpoints;
            logger_1.logger.debug(`Startup successful: ${checkpoints.length} checkpoints passed in ${durationMs}ms`);
        }
        catch (error) {
            logger_1.logger.debug('Failed to log startup success:', error);
        }
    }
    getCheckpoints() {
        return [...this.checkpoints];
    }
    getStartupDuration() {
        return Date.now() - this.startTime;
    }
    getStartupData() {
        if (!this.enabled) {
            return null;
        }
        return {
            durationMs: this.getStartupDuration(),
            checkpoints: this.getCheckpoints(),
        };
    }
    isEnabled() {
        return this.enabled && this.supabase !== null && this.userId !== null;
    }
}
exports.EarlyErrorLogger = EarlyErrorLogger;
EarlyErrorLogger.instance = null;
//# sourceMappingURL=early-error-logger.js.map