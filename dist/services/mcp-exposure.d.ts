import { N8nApiClient } from './n8n-api-client';
import { McpToolResponse } from '../types/n8n-api';
import { InstanceContext } from '../types/instance-context';
export declare const NOT_EXPOSED_PREFIX = "Workflow is not available in MCP";
export declare const WORKFLOW_NOT_EXPOSED_HINT: string;
export declare const PUBLIC_API_CONTEXT_HINT: string;
export declare function publicApiMatchesContext(context?: InstanceContext | null): boolean;
export declare function isNotExposedResponse(response: McpToolResponse): boolean;
export declare function enableWorkflowMcpExposure(apiClient: N8nApiClient, workflowId: string): Promise<{
    warnings: string[];
}>;
export interface ExposureOptions {
    apiClient: N8nApiClient | null;
    workflowId: string;
    exposeToMcp?: boolean;
    action: string;
    toolName: 'n8n_test_workflow' | 'n8n_workflow_versions';
    context?: InstanceContext | null;
}
export declare function withMcpExposure(opts: ExposureOptions, call: () => Promise<McpToolResponse>): Promise<McpToolResponse>;
//# sourceMappingURL=mcp-exposure.d.ts.map