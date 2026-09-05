import { InstanceContext } from '../types/instance-context';
import { McpToolResponse } from '../types/n8n-api';
export declare const OFFICIAL_TOOL_MIN_VERSION: Record<string, string>;
export declare function callOfficialTool(context: InstanceContext | undefined, toolAliases: string[], args: Record<string, unknown>, timeoutMs: number, label: string, idempotent: boolean): Promise<McpToolResponse>;
export declare function handleExploreNodeResources(args: unknown, context?: InstanceContext): Promise<McpToolResponse>;
export declare function handleListCatalog(args: unknown, context?: InstanceContext): Promise<McpToolResponse>;
export interface ProjectChoice {
    id: string;
    name: string;
    type?: string;
    personal?: boolean;
}
export interface ProjectChoices {
    backend: 'public-api' | 'official-mcp';
    teamProjectsEnabled: boolean;
    items: ProjectChoice[];
}
export declare function resolveProjectChoices(context?: InstanceContext): Promise<{
    choices: ProjectChoices;
} | {
    failure: McpToolResponse;
}>;
//# sourceMappingURL=handlers-official-tools.d.ts.map