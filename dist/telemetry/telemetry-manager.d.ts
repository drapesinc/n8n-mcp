export declare class TelemetryManager {
    private static instance;
    private supabase;
    private configManager;
    private eventTracker;
    private batchProcessor;
    private performanceMonitor;
    private errorAggregator;
    private isInitialized;
    private constructor();
    static getInstance(): TelemetryManager;
    private ensureInitialized;
    private initialize;
    trackToolUsage(toolName: string, success: boolean, duration?: number): void;
    trackWorkflowCreation(workflow: any, validationPassed: boolean): Promise<void>;
    trackWorkflowMutation(data: any): Promise<void>;
    trackError(errorType: string, context: string, toolName?: string, errorMessage?: string): void;
    trackEvent(eventName: string, properties: Record<string, any>): void;
    trackSessionStart(): void;
    trackSearchQuery(query: string, resultsFound: number, searchType: string): void;
    trackValidationDetails(nodeType: string, errorType: string, details: Record<string, any>): void;
    trackToolSequence(previousTool: string, currentTool: string, timeDelta: number): void;
    trackNodeConfiguration(nodeType: string, propertiesSet: number, usedDefaults: boolean): void;
    trackPerformanceMetric(operation: string, duration: number, metadata?: Record<string, any>): void;
    flush(): Promise<void>;
    flushBeforeExit(timeoutMs?: number): Promise<void>;
    flushMutations(): Promise<void>;
    private isEnabled;
    disable(): void;
    enable(): void;
    getStatus(): string;
    getMetrics(): {
        status: string;
        initialized: boolean;
        tracking: {
            rateLimiter: {
                currentEvents: number;
                maxEvents: number;
                windowMs: number;
                droppedEvents: number;
                utilizationPercent: number;
                remainingCapacity: number;
                arraySize: number;
                maxArraySize: number;
                memoryUsagePercent: number;
            };
            validator: {
                errors: number;
                successes: number;
                total: number;
                errorRate: number;
            };
            eventQueueSize: number;
            workflowQueueSize: number;
            mutationQueueSize: number;
            performanceMetrics: Record<string, any>;
        };
        processing: import("./telemetry-types").TelemetryMetrics & {
            circuitBreakerState: any;
            deadLetterQueueSize: number;
        };
        errors: {
            totalErrors: number;
            errorsByType: Record<string, number>;
            mostCommonError?: string;
            recentErrors: import("./telemetry-types").TelemetryErrorContext[];
        };
        performance: {
            summary: {
                totalOperations: number;
                averageDuration: number;
                slowOperations: number;
                operationsByType: {};
                memoryUsage: {
                    heapUsed: number;
                    heapTotal: number;
                    external: number;
                } | undefined;
                uptimeMs: number;
                overhead: {
                    percentage: number;
                    totalMs: number;
                };
                operationsInLastMinute?: undefined;
            } | {
                totalOperations: number;
                operationsInLastMinute: number;
                averageDuration: number;
                slowOperations: number;
                operationsByType: Record<string, {
                    count: number;
                    avgDuration: number;
                }>;
                memoryUsage: {
                    heapUsed: number;
                    heapTotal: number;
                    external: number;
                } | undefined;
                uptimeMs: number;
                overhead: {
                    percentage: number;
                    totalMs: number;
                };
            };
            percentiles: {
                p50: number;
                p75: number;
                p90: number;
                p95: number;
                p99: number;
            };
            topSlowOperations: {
                operation: string;
                duration: number;
                timestamp: number;
            }[];
            memoryTrend: {
                trend: string;
                delta: number;
            };
            recommendations: string[];
        };
        overhead: {
            percentage: number;
            impact: "minimal" | "low" | "moderate" | "high";
        };
    };
    static resetInstance(): void;
}
export declare const telemetry: TelemetryManager;
//# sourceMappingURL=telemetry-manager.d.ts.map