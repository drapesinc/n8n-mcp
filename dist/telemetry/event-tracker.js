"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryEventTracker = void 0;
const workflow_sanitizer_1 = require("./workflow-sanitizer");
const rate_limiter_1 = require("./rate-limiter");
const event_validator_1 = require("./event-validator");
const telemetry_error_1 = require("./telemetry-error");
const logger_1 = require("../utils/logger");
const fs_1 = require("fs");
const path_1 = require("path");
const error_sanitization_utils_1 = require("./error-sanitization-utils");
class TelemetryEventTracker {
    constructor(getUserId, isEnabled) {
        this.getUserId = getUserId;
        this.isEnabled = isEnabled;
        this.eventQueue = [];
        this.workflowQueue = [];
        this.mutationQueue = [];
        this.previousToolTimestamp = 0;
        this.performanceMetrics = new Map();
        this.rateLimiter = new rate_limiter_1.TelemetryRateLimiter();
        this.validator = new event_validator_1.TelemetryEventValidator();
    }
    trackToolUsage(toolName, success, duration) {
        if (!this.isEnabled())
            return;
        if (!this.rateLimiter.allow()) {
            logger_1.logger.debug(`Rate limited: tool_used event for ${toolName}`);
            return;
        }
        if (duration !== undefined) {
            this.recordPerformanceMetric(toolName, duration);
        }
        const event = {
            user_id: this.getUserId(),
            event: 'tool_used',
            properties: {
                tool: toolName.replace(/[^a-zA-Z0-9_-]/g, '_'),
                success,
                duration: duration || 0,
            }
        };
        const validated = this.validator.validateEvent(event);
        if (validated) {
            this.eventQueue.push(validated);
        }
    }
    async trackWorkflowCreation(workflow, validationPassed) {
        if (!this.isEnabled())
            return;
        if (!this.rateLimiter.allow()) {
            logger_1.logger.debug('Rate limited: workflow creation event');
            return;
        }
        if (!validationPassed) {
            this.trackEvent('workflow_validation_failed', {
                nodeCount: workflow.nodes?.length || 0,
            });
            return;
        }
        try {
            const sanitized = workflow_sanitizer_1.WorkflowSanitizer.sanitizeWorkflow(workflow);
            const telemetryData = {
                user_id: this.getUserId(),
                workflow_hash: sanitized.workflowHash,
                node_count: sanitized.nodeCount,
                node_types: sanitized.nodeTypes,
                has_trigger: sanitized.hasTrigger,
                has_webhook: sanitized.hasWebhook,
                complexity: sanitized.complexity,
                sanitized_workflow: {
                    nodes: sanitized.nodes,
                    connections: sanitized.connections,
                },
            };
            const validated = this.validator.validateWorkflow(telemetryData);
            if (validated) {
                this.workflowQueue.push(validated);
                this.trackEvent('workflow_created', {
                    nodeCount: sanitized.nodeCount,
                    nodeTypes: sanitized.nodeTypes.length,
                    complexity: sanitized.complexity,
                    hasTrigger: sanitized.hasTrigger,
                    hasWebhook: sanitized.hasWebhook,
                });
            }
        }
        catch (error) {
            logger_1.logger.debug('Failed to track workflow creation:', error);
            throw new telemetry_error_1.TelemetryError(telemetry_error_1.TelemetryErrorType.VALIDATION_ERROR, 'Failed to sanitize workflow', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    trackError(errorType, context, toolName, errorMessage) {
        if (!this.isEnabled())
            return;
        this.trackEvent('error_occurred', {
            errorType: this.sanitizeErrorType(errorType),
            context: this.sanitizeContext(context),
            tool: toolName ? toolName.replace(/[^a-zA-Z0-9_-]/g, '_') : undefined,
            error: errorMessage ? this.sanitizeErrorMessage(errorMessage) : undefined,
            mcpMode: process.env.MCP_MODE || 'stdio',
            platform: process.platform
        }, false);
    }
    trackEvent(eventName, properties, checkRateLimit = true) {
        if (!this.isEnabled())
            return;
        if (checkRateLimit && !this.rateLimiter.allow()) {
            logger_1.logger.debug(`Rate limited: ${eventName} event`);
            return;
        }
        const event = {
            user_id: this.getUserId(),
            event: eventName,
            properties,
        };
        const validated = this.validator.validateEvent(event);
        if (validated) {
            this.eventQueue.push(validated);
        }
    }
    trackSessionStart(startupData) {
        if (!this.isEnabled())
            return;
        this.trackEvent('session_start', {
            version: this.getPackageVersion(),
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            isDocker: process.env.IS_DOCKER === 'true',
            cloudPlatform: this.detectCloudPlatform(),
            mcpMode: process.env.MCP_MODE || 'stdio',
            startupDurationMs: startupData?.durationMs,
            checkpointsPassed: startupData?.checkpoints,
            startupErrorCount: startupData?.errorCount || 0,
        });
    }
    trackStartupComplete() {
        if (!this.isEnabled())
            return;
        this.trackEvent('startup_completed', {
            version: this.getPackageVersion(),
        });
    }
    detectCloudPlatform() {
        if (process.env.RAILWAY_ENVIRONMENT)
            return 'railway';
        if (process.env.RENDER)
            return 'render';
        if (process.env.FLY_APP_NAME)
            return 'fly';
        if (process.env.HEROKU_APP_NAME)
            return 'heroku';
        if (process.env.AWS_EXECUTION_ENV)
            return 'aws';
        if (process.env.KUBERNETES_SERVICE_HOST)
            return 'kubernetes';
        if (process.env.GOOGLE_CLOUD_PROJECT)
            return 'gcp';
        if (process.env.AZURE_FUNCTIONS_ENVIRONMENT)
            return 'azure';
        return null;
    }
    trackSearchQuery(query, resultsFound, searchType) {
        if (!this.isEnabled())
            return;
        this.trackEvent('search_query', {
            query: query.substring(0, 100),
            resultsFound,
            searchType,
            hasResults: resultsFound > 0,
            isZeroResults: resultsFound === 0
        });
    }
    trackValidationDetails(nodeType, errorType, details) {
        if (!this.isEnabled())
            return;
        const sanitize = (value) => workflow_sanitizer_1.WorkflowSanitizer.sanitizeTelemetryObject((0, event_validator_1.sanitizeEventString)(value));
        const sanitizedDetails = details && typeof details === 'object'
            ? Object.fromEntries(Object.entries(details).map(([key, value]) => [key, typeof value === 'string' ? sanitize(value) : value]))
            : details;
        const sanitizedName = workflow_sanitizer_1.WorkflowSanitizer.sanitizeNodeName(nodeType);
        const safeName = sanitizedName === nodeType
            ? nodeType
            : `[REDACTED]${sanitizedName.slice(sanitizedName.lastIndexOf(' #'))}`;
        this.trackEvent('validation_details', {
            nodeType: safeName.replace(/[^a-zA-Z0-9_.-]/g, '_'),
            errorType: this.sanitizeErrorType(errorType),
            errorCategory: this.categorizeError(errorType),
            details: sanitizedDetails
        });
    }
    trackToolSequence(previousTool, currentTool, timeDelta) {
        if (!this.isEnabled())
            return;
        this.trackEvent('tool_sequence', {
            previousTool: previousTool.replace(/[^a-zA-Z0-9_-]/g, '_'),
            currentTool: currentTool.replace(/[^a-zA-Z0-9_-]/g, '_'),
            timeDelta: Math.min(timeDelta, 300000),
            isSlowTransition: timeDelta > 10000,
            sequence: `${previousTool}->${currentTool}`
        });
    }
    trackNodeConfiguration(nodeType, propertiesSet, usedDefaults) {
        if (!this.isEnabled())
            return;
        this.trackEvent('node_configuration', {
            nodeType: nodeType.replace(/[^a-zA-Z0-9_.-]/g, '_'),
            propertiesSet,
            usedDefaults,
            complexity: this.categorizeConfigComplexity(propertiesSet)
        });
    }
    trackPerformanceMetric(operation, duration, metadata) {
        if (!this.isEnabled())
            return;
        this.recordPerformanceMetric(operation, duration);
        this.trackEvent('performance_metric', {
            operation: operation.replace(/[^a-zA-Z0-9_-]/g, '_'),
            duration,
            isSlow: duration > 1000,
            isVerySlow: duration > 5000,
            metadata
        });
    }
    updateToolSequence(toolName) {
        if (this.previousTool) {
            const timeDelta = Date.now() - this.previousToolTimestamp;
            this.trackToolSequence(this.previousTool, toolName, timeDelta);
        }
        this.previousTool = toolName;
        this.previousToolTimestamp = Date.now();
    }
    getEventQueue() {
        return [...this.eventQueue];
    }
    getWorkflowQueue() {
        return [...this.workflowQueue];
    }
    getMutationQueue() {
        return [...this.mutationQueue];
    }
    clearEventQueue() {
        this.eventQueue = [];
    }
    clearWorkflowQueue() {
        this.workflowQueue = [];
    }
    clearMutationQueue() {
        this.mutationQueue = [];
    }
    enqueueMutation(mutation) {
        if (!this.isEnabled())
            return;
        this.mutationQueue.push(mutation);
    }
    getMutationQueueSize() {
        return this.mutationQueue.length;
    }
    getStats() {
        return {
            rateLimiter: this.rateLimiter.getStats(),
            validator: this.validator.getStats(),
            eventQueueSize: this.eventQueue.length,
            workflowQueueSize: this.workflowQueue.length,
            mutationQueueSize: this.mutationQueue.length,
            performanceMetrics: this.getPerformanceStats()
        };
    }
    recordPerformanceMetric(operation, duration) {
        if (!this.performanceMetrics.has(operation)) {
            this.performanceMetrics.set(operation, []);
        }
        const metrics = this.performanceMetrics.get(operation);
        metrics.push(duration);
        if (metrics.length > 100) {
            metrics.shift();
        }
    }
    getPerformanceStats() {
        const stats = {};
        for (const [operation, durations] of this.performanceMetrics.entries()) {
            if (durations.length === 0)
                continue;
            const sorted = [...durations].sort((a, b) => a - b);
            const sum = sorted.reduce((a, b) => a + b, 0);
            stats[operation] = {
                count: sorted.length,
                min: sorted[0],
                max: sorted[sorted.length - 1],
                avg: Math.round(sum / sorted.length),
                p50: sorted[Math.floor(sorted.length * 0.5)],
                p95: sorted[Math.floor(sorted.length * 0.95)],
                p99: sorted[Math.floor(sorted.length * 0.99)]
            };
        }
        return stats;
    }
    categorizeError(errorType) {
        const lowerError = errorType.toLowerCase();
        if (lowerError.includes('type'))
            return 'type_error';
        if (lowerError.includes('validation'))
            return 'validation_error';
        if (lowerError.includes('required'))
            return 'required_field_error';
        if (lowerError.includes('connection'))
            return 'connection_error';
        if (lowerError.includes('expression'))
            return 'expression_error';
        return 'other_error';
    }
    categorizeConfigComplexity(propertiesSet) {
        if (propertiesSet === 0)
            return 'defaults_only';
        if (propertiesSet <= 3)
            return 'simple';
        if (propertiesSet <= 10)
            return 'moderate';
        return 'complex';
    }
    getPackageVersion() {
        try {
            const possiblePaths = [
                (0, path_1.resolve)(__dirname, '..', '..', 'package.json'),
                (0, path_1.resolve)(process.cwd(), 'package.json'),
                (0, path_1.resolve)(__dirname, '..', '..', '..', 'package.json')
            ];
            for (const packagePath of possiblePaths) {
                if ((0, fs_1.existsSync)(packagePath)) {
                    const packageJson = JSON.parse((0, fs_1.readFileSync)(packagePath, 'utf-8'));
                    if (packageJson.version) {
                        return packageJson.version;
                    }
                }
            }
            return 'unknown';
        }
        catch (error) {
            logger_1.logger.debug('Failed to get package version:', error);
            return 'unknown';
        }
    }
    sanitizeErrorType(errorType) {
        return errorType.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    }
    sanitizeContext(context) {
        let sanitized = context
            .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
            .replace(/\b[a-zA-Z0-9_-]{32,}/g, '[KEY]')
            .replace(/(https?:\/\/)([^\s\/]+)(\/[^\s]*)?/gi, (match, protocol, domain, path) => {
            return '[URL]' + (path || '');
        });
        if (sanitized.length > 100) {
            sanitized = sanitized.substring(0, 100);
        }
        return sanitized;
    }
    sanitizeErrorMessage(errorMessage) {
        return (0, error_sanitization_utils_1.sanitizeErrorMessageCore)(errorMessage);
    }
}
exports.TelemetryEventTracker = TelemetryEventTracker;
//# sourceMappingURL=event-tracker.js.map