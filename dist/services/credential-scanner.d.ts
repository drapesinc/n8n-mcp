export interface SecretPattern {
    regex: RegExp;
    label: string;
    category: string;
    severity: 'critical' | 'high' | 'medium';
}
export interface ScanDetection {
    label: string;
    category: string;
    severity: 'critical' | 'high' | 'medium';
    location: {
        workflowId: string;
        workflowName: string;
        nodeName?: string;
        nodeType?: string;
    };
    maskedSnippet?: string;
}
export declare const SECRET_PATTERNS: SecretPattern[];
export declare const PII_PATTERNS: SecretPattern[];
export declare function maskSecret(value: string): string;
interface ScanWorkflowInput {
    id?: string;
    name: string;
    nodes: Array<{
        id?: string;
        name: string;
        type: string;
        parameters?: Record<string, unknown>;
        notes?: string;
        [key: string]: unknown;
    }>;
    settings?: Record<string, unknown>;
    staticData?: Record<string, unknown>;
    pinData?: Record<string, unknown>;
}
export declare function scanWorkflow(workflow: ScanWorkflowInput): ScanDetection[];
export {};
//# sourceMappingURL=credential-scanner.d.ts.map