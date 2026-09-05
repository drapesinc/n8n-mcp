export type OfficialMcpErrorCode = 'NOT_CONFIGURED' | 'OFFICIAL_MCP_AUTH_FAILED' | 'OFFICIAL_MCP_NOT_ENABLED' | 'OFFICIAL_MCP_RATE_LIMITED' | 'OFFICIAL_MCP_TOOL_UNAVAILABLE' | 'OFFICIAL_MCP_URL_REJECTED' | 'OFFICIAL_MCP_TIMEOUT' | 'OFFICIAL_MCP_TRANSPORT_ERROR';
export declare const OFFICIAL_MCP_HINTS: Record<OfficialMcpErrorCode, string>;
export declare class OfficialMcpError extends Error {
    readonly code: OfficialMcpErrorCode;
    readonly status?: number | undefined;
    readonly retryable: boolean;
    constructor(code: OfficialMcpErrorCode, message: string, status?: number | undefined, retryable?: boolean);
    get hint(): string;
}
export declare const AGENT_TOOL_NAMES: readonly ["search_agents", "get_agent", "create_agent", "mutate_agent", "validate_agent", "call_agent", "publish_agent", "unpublish_agent", "revert_agent", "list_agent_versions", "delete_agent", "discover_agent_assets", "verify_agent_mcp_server", "update_agent_integration", "get_agent_builder_reference"];
export interface OfficialMcpCapabilities {
    reachable: boolean;
    toolCount: number;
    toolNames: string[];
    agentTools: boolean;
    checkedAt: number;
    error?: OfficialMcpErrorCode;
}
export interface OfficialToolResult {
    isError: boolean;
    text: string;
    json?: unknown;
    sizeBytes: number;
    truncated: boolean;
}
export interface AgentBuilderReference {
    ok?: boolean;
    uri?: string;
    guide?: string;
    configSchema?: unknown;
    [key: string]: unknown;
}
export declare const OFFICIAL_MCP_CACHE_TTL_MS: number;
export declare const OFFICIAL_MCP_FAILURE_TTL_MS = 30000;
export declare const OFFICIAL_RESULT_MAX_BYTES: number;
export declare function mapOfficialTransportError(err: unknown): OfficialMcpError;
export declare class N8nOfficialMcpClient {
    readonly endpoint: string;
    private readonly token;
    private readonly host;
    private client;
    private pinned;
    private connecting;
    private caps;
    private ref;
    private generation;
    private closed;
    private hasConnectedSuccessfully;
    constructor(opts: {
        endpoint: string;
        token: string;
        instanceId?: string;
    });
    private connect;
    private resetTransport;
    capabilities(force?: boolean): Promise<OfficialMcpCapabilities>;
    hasTool(name: string): Promise<boolean>;
    callTool(name: string, args: Record<string, unknown>, opts?: {
        timeoutMs?: number;
        idempotent?: boolean;
    }): Promise<OfficialToolResult>;
    reference(tool?: string): Promise<AgentBuilderReference>;
    cachedCapabilities(): OfficialMcpCapabilities | null;
    close(): Promise<void>;
}
export declare function probeOfficialMcp(opts: {
    endpoint: string;
    token: string;
}): Promise<OfficialMcpCapabilities>;
//# sourceMappingURL=n8n-official-mcp-client.d.ts.map