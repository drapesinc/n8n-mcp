import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import type { InstanceContext } from './instance-context';
export interface AdditionalToolContext {
    instanceContext?: InstanceContext;
}
export interface AdditionalTool {
    tool: Tool;
    handler: (args: unknown, context: AdditionalToolContext) => Promise<CallToolResult>;
}
//# sourceMappingURL=additional-tools.d.ts.map