interface WorkflowNode {
    id: string;
    name: string;
    type: string;
    position: [number, number];
    parameters: any;
    credentials?: any;
    disabled?: boolean;
    typeVersion?: number;
}
interface SanitizedWorkflow {
    nodes: WorkflowNode[];
    connections: any;
    nodeCount: number;
    nodeTypes: string[];
    hasTrigger: boolean;
    hasWebhook: boolean;
    complexity: 'simple' | 'medium' | 'complex';
    workflowHash: string;
}
export declare class WorkflowSanitizer {
    private static readonly SENSITIVE_PATTERNS;
    private static readonly PII_PATTERNS;
    private static readonly OPAQUE_TOKEN_PATTERNS;
    private static readonly UUID_PATTERN;
    private static readonly UUID_SHIELD;
    private static readonly SECRET_KEY_WORDS;
    private static readonly SECRET_KEYS;
    private static readonly COUNT_WORDS;
    private static readonly SECRET_KEY_COMPOUNDS;
    private static readonly TOPOLOGY_KEY_WORDS;
    private static readonly URL_KEY_WORDS;
    private static readonly AUTH_SCHEME_PREFIX;
    static sanitizeWorkflow(workflow: any): SanitizedWorkflow;
    static sanitizeTelemetryObject<T = any>(value: any): T;
    private static sanitizeNode;
    private static sanitizeObject;
    private static sanitizeString;
    private static applyPatterns;
    private static redactSecret;
    private static redactUrlValue;
    private static classifyKey;
    private static sanitizeConnections;
    static generateWorkflowHash(workflow: any): string;
    static sanitizeWorkflowRaw(workflow: any): any;
}
export {};
//# sourceMappingURL=workflow-sanitizer.d.ts.map