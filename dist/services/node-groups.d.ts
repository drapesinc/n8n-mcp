import { z } from 'zod';
import { WorkflowNodeGroup, Workflow, WorkflowNode } from '../types/n8n-api';
export declare const GROUP_DESCRIPTION_MAX_LENGTH = 155;
export declare const nodeGroupInputSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    nodeIds: z.ZodArray<z.ZodString, "many">;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    nodeIds: string[];
    description?: string | undefined;
    id?: string | undefined;
}, {
    name: string;
    nodeIds: string[];
    description?: string | undefined;
    id?: string | undefined;
}>;
export type NodeGroupInput = z.infer<typeof nodeGroupInputSchema>;
export declare function parseNodeGroupsInput(value: unknown): WorkflowNodeGroup[] | undefined;
export declare function toWorkflowNodeGroup(group: NodeGroupInput): WorkflowNodeGroup;
export interface NodeGroupIssue {
    code: 'group-member-removed' | 'group-empty' | 'group-unknown-keys' | 'group-malformed' | 'group-duplicate-name' | 'group-node-in-multiple-groups' | 'group-contains-trigger' | 'group-rejected-by-n8n';
    group: string;
    message: string;
}
export interface RepairResult {
    nodeGroups?: WorkflowNodeGroup[];
    issues: NodeGroupIssue[];
    errors?: string[];
}
export declare function nodeGroupsField(groups: WorkflowNodeGroup[] | undefined): {
    nodeGroups?: WorkflowNodeGroup[];
};
export declare function sanitizeGroupsForApi(groups: unknown, options: {
    includeDescription: boolean;
}): WorkflowNodeGroup[];
export declare function repairNodeGroups(workflow: Pick<Workflow, 'nodes' | 'nodeGroups'>, options?: {
    authoredGroups?: Set<string>;
}): RepairResult;
export declare function checkNodeGroups(workflow: Pick<Workflow, 'nodes' | 'nodeGroups'>, options?: {
    isTrigger?: (node: WorkflowNode) => boolean;
}): NodeGroupIssue[];
export declare function dropRejectedGroup(groups: WorkflowNodeGroup[], target: {
    groupId?: string;
    groupName?: string;
}): {
    groups: WorkflowNodeGroup[];
    dropped: WorkflowNodeGroup | null;
};
export type GroupErrorKind = 'schema-description' | 'schema-field' | 'semantic' | 'unrelated';
export interface GroupErrorClassification {
    kind: GroupErrorKind;
    groupName?: string;
    groupId?: string;
    message: string;
}
export declare function classifyGroupError(error: unknown): GroupErrorClassification;
//# sourceMappingURL=node-groups.d.ts.map