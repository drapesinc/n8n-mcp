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
    private static readonly SENSITIVE_FIELDS;
    static sanitizeWorkflow(workflow: any): SanitizedWorkflow;
    static sanitizeTelemetryObject<T = any>(value: any): T;
    private static sanitizeNode;
    private static sanitizeObject;
    private static sanitizeString;
    private static isSensitiveField;
    private static sanitizeConnections;
    static generateWorkflowHash(workflow: any): string;
    static sanitizeWorkflowRaw(workflow: any): any;
}
export {};
//# sourceMappingURL=workflow-sanitizer.d.ts.map