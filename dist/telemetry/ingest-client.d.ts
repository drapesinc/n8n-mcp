export type IngestTable = 'telemetry_events' | 'telemetry_workflows' | 'workflow_mutations';
export type ControlSignal = {
    kind: 'disable_version' | 'disable_process';
    status: number;
};
export interface IngestResult {
    error: {
        message: string;
        status: number;
    } | null;
    status: number;
    dropped?: boolean;
}
export declare function resetIngestClientProcessStateForTests(): void;
export interface IngestClientOptions {
    url: string;
    key: string;
    version: string;
    fetchImpl?: typeof fetch;
    onControl?: (signal: ControlSignal) => void;
}
export declare class IngestClient {
    private readonly opts;
    private readonly base;
    private readonly fetchImpl;
    constructor(opts: IngestClientOptions);
    from(table: IngestTable): {
        insert: (rows: object | object[]) => Promise<IngestResult>;
    };
    private send;
}
//# sourceMappingURL=ingest-client.d.ts.map