export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low';
export type RemediationType = 'auto_fixable' | 'user_input_needed' | 'user_action_needed' | 'review_recommended';
export type CustomCheckType = 'hardcoded_secrets' | 'unauthenticated_webhooks' | 'error_handling' | 'data_retention';
export interface AuditFinding {
    id: string;
    severity: AuditSeverity;
    category: CustomCheckType;
    title: string;
    description: string;
    recommendation: string;
    remediationType: RemediationType;
    remediation?: {
        tool: string;
        args: Record<string, unknown>;
        description: string;
    }[];
    location: {
        workflowId: string;
        workflowName: string;
        workflowActive?: boolean;
        nodeName?: string;
        nodeType?: string;
    };
}
export interface WorkflowSecurityReport {
    findings: AuditFinding[];
    workflowsScanned: number;
    scanDurationMs: number;
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        total: number;
    };
}
export declare function scanWorkflows(workflows: Array<{
    id?: string;
    name: string;
    nodes: any[];
    active?: boolean;
    settings?: any;
    staticData?: any;
    connections?: any;
}>, checks?: CustomCheckType[]): WorkflowSecurityReport;
//# sourceMappingURL=workflow-security-scanner.d.ts.map