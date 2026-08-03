import { StartupCheckpoint } from './startup-checkpoints';
export interface TelemetryEvent {
    user_id: string;
    event: string;
    properties: Record<string, any>;
    created_at?: string;
}
export interface StartupErrorEvent extends TelemetryEvent {
    event: 'startup_error';
    properties: {
        checkpoint: StartupCheckpoint;
        errorMessage: string;
        errorType: string;
        checkpointsPassed: StartupCheckpoint[];
        checkpointsPassedCount: number;
        startupDuration: number;
        platform: string;
        arch: string;
        nodeVersion: string;
        isDocker: boolean;
    };
}
export interface StartupCompletedEvent extends TelemetryEvent {
    event: 'startup_completed';
    properties: {
        version: string;
    };
}
export interface SessionStartProperties {
    version: string;
    platform: string;
    arch: string;
    nodeVersion: string;
    isDocker: boolean;
    cloudPlatform: string | null;
    startupDurationMs?: number;
    checkpointsPassed?: StartupCheckpoint[];
    startupErrorCount?: number;
}
export interface WorkflowTelemetry {
    user_id: string;
    workflow_hash: string;
    node_count: number;
    node_types: string[];
    has_trigger: boolean;
    has_webhook: boolean;
    complexity: 'simple' | 'medium' | 'complex';
    sanitized_workflow: any;
    created_at?: string;
}
export interface SanitizedWorkflow {
    nodes: any[];
    connections: any;
    nodeCount: number;
    nodeTypes: string[];
    hasTrigger: boolean;
    hasWebhook: boolean;
    complexity: 'simple' | 'medium' | 'complex';
    workflowHash: string;
}
export declare const TELEMETRY_CONFIG: {
    readonly BATCH_FLUSH_INTERVAL: 5000;
    readonly EVENT_QUEUE_THRESHOLD: 10;
    readonly WORKFLOW_QUEUE_THRESHOLD: 5;
    readonly OPERATION_TIMEOUT: 5000;
    readonly FETCH_TIMEOUT_MS: 2000;
    readonly RATE_LIMIT_WINDOW: 60000;
    readonly RATE_LIMIT_MAX_EVENTS: 100;
    readonly MAX_QUEUE_SIZE: 1000;
    readonly MAX_BATCH_SIZE: 50;
};
export declare const TELEMETRY_BACKEND: {
    readonly URL: "https://ydyufsohxdfpopqbubwk.supabase.co";
    readonly ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkeXVmc29oeGRmcG9wcWJ1YndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3OTYyMDAsImV4cCI6MjA3NDM3MjIwMH0.xESphg6h5ozaDsm4Vla3QnDJGc6Nc_cpfoqTHRynkCk";
};
export interface TelemetryMetrics {
    eventsTracked: number;
    eventsDropped: number;
    eventsFailed: number;
    batchesSent: number;
    batchesFailed: number;
    averageFlushTime: number;
    lastFlushTime?: number;
    rateLimitHits: number;
}
export declare enum TelemetryErrorType {
    VALIDATION_ERROR = "VALIDATION_ERROR",
    NETWORK_ERROR = "NETWORK_ERROR",
    RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
    QUEUE_OVERFLOW_ERROR = "QUEUE_OVERFLOW_ERROR",
    INITIALIZATION_ERROR = "INITIALIZATION_ERROR",
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
}
export interface TelemetryErrorContext {
    type: TelemetryErrorType;
    message: string;
    context?: Record<string, any>;
    timestamp: number;
    retryable: boolean;
}
export type { WorkflowMutationRecord, WorkflowMutationData } from './mutation-types.js';
//# sourceMappingURL=telemetry-types.d.ts.map