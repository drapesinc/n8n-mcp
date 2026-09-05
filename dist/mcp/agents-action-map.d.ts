export type AgentAction = 'reference' | 'search' | 'get' | 'create' | 'mutate' | 'validate' | 'call' | 'publish' | 'unpublish' | 'revert' | 'versions' | 'delete' | 'discover_assets' | 'verify_mcp_server' | 'update_integration';
export interface AgentActionSpec {
    tools: string[];
    defaultTimeoutMs: number;
    destructive: boolean;
    idempotent: boolean;
}
export declare const DEFAULT_TIMEOUT_MS = 30000;
export declare const CALL_TIMEOUT_MS = 180000;
export declare const MIN_TIMEOUT_MS = 5000;
export declare const MAX_TIMEOUT_MS = 600000;
export declare const PINNED_TIMEOUT_MS = 300000;
export declare const AGENT_ACTION_MAP: Record<AgentAction, AgentActionSpec>;
export declare const AGENT_ACTIONS: AgentAction[];
export declare const DESTRUCTIVE_AGENT_ACTIONS: AgentAction[];
export declare function resolveOfficialTool(spec: AgentActionSpec, available: string[]): string | null;
//# sourceMappingURL=agents-action-map.d.ts.map