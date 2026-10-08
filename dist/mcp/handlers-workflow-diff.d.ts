import { McpToolResponse } from '../types/n8n-api';
import { InstanceContext } from '../types/instance-context';
import { NodeRepository } from '../database/node-repository';
export declare function settingsUpdateWouldPublishDraft(workflow: {
    active?: boolean;
    versionId?: string | null;
    activeVersionId?: string | null;
}, operations: Array<{
    type?: string;
}>): boolean;
export declare function handleUpdatePartialWorkflow(args: unknown, repository: NodeRepository, context?: InstanceContext): Promise<McpToolResponse>;
//# sourceMappingURL=handlers-workflow-diff.d.ts.map