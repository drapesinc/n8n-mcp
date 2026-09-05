import { InstanceContext } from '../types/instance-context';
import { OfficialMcpConfig } from '../config/n8n-api';
import { N8nOfficialMcpClient, OfficialMcpErrorCode } from '../services/n8n-official-mcp-client';
export interface OfficialMcpFailure {
    success: false;
    action?: string;
    code: string;
    error: string;
    hint?: string;
    officialError?: unknown;
    details?: Record<string, unknown>;
}
export declare function resolveOfficialMcpConfig(context?: InstanceContext): OfficialMcpConfig | null;
export declare function getOfficialMcpClient(context?: InstanceContext): N8nOfficialMcpClient | null;
export declare function notConfiguredResponse(context?: InstanceContext, action?: string): OfficialMcpFailure;
export declare function officialErrorText(data: unknown, officialCode: string | undefined): string;
export declare function officialFailure(err: unknown, action?: string): OfficialMcpFailure;
export interface OfficialMcpHealth {
    configured: boolean;
    endpoint?: string;
    reachable?: boolean;
    toolCount?: number;
    agentTools?: boolean;
    checkedAt?: string;
    error?: OfficialMcpErrorCode;
    hint?: string;
}
export declare function buildOfficialMcpHealth(context: InstanceContext | undefined, live: boolean): Promise<OfficialMcpHealth>;
export declare function clearOfficialMcpClientCache(): Promise<void>;
//# sourceMappingURL=official-mcp-access.d.ts.map