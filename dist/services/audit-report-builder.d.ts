import type { WorkflowSecurityReport } from './workflow-security-scanner';
export interface AuditReportInput {
    builtinAudit: any;
    customReport: WorkflowSecurityReport | null;
    performance: {
        builtinAuditMs: number;
        workflowFetchMs: number;
        customScanMs: number;
        totalMs: number;
    };
    instanceUrl: string;
    warnings?: string[];
}
export interface UnifiedAuditReport {
    markdown: string;
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        totalFindings: number;
        workflowsScanned: number;
    };
}
export declare function buildAuditReport(input: AuditReportInput): UnifiedAuditReport;
//# sourceMappingURL=audit-report-builder.d.ts.map