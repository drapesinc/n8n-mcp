import { IngestClient } from './ingest-client';
import { TelemetryEvent, WorkflowTelemetry, WorkflowMutationRecord, TelemetryMetrics } from './telemetry-types';
export declare class TelemetryBatchProcessor {
    private ingestClient;
    private isEnabled;
    private flushTimer?;
    private flushQueue;
    private circuitBreaker;
    private metrics;
    private flushTimes;
    private deadLetterQueue;
    private readonly maxDeadLetterSize;
    private eventListeners;
    private started;
    private readonly operationTimeout;
    private readonly onFlushRequested?;
    constructor(ingestClient: IngestClient | null, isEnabled: () => boolean, options?: {
        operationTimeout?: number;
        onFlushRequested?: () => void | Promise<void>;
    });
    start(): void;
    stop(): void;
    private requestFlush;
    private flushAndExit;
    flush(events?: TelemetryEvent[], workflows?: WorkflowTelemetry[], mutations?: WorkflowMutationRecord[]): Promise<void>;
    private flushQueuedBatch;
    private prepareBatches;
    private prepareEventBatches;
    private prepareWorkflowBatches;
    private prepareMutationBatches;
    private flushEvents;
    private flushWorkflows;
    private flushMutations;
    private executeWithTimeout;
    private createByteAwareBatches;
    private deduplicateWorkflows;
    private addUnsentBatchesToDeadLetterQueue;
    private addToDeadLetterQueue;
    private processDeadLetterQueue;
    private recordFlushTime;
    getMetrics(): TelemetryMetrics & {
        circuitBreakerState: any;
        deadLetterQueueSize: number;
    };
    resetMetrics(): void;
}
//# sourceMappingURL=batch-processor.d.ts.map