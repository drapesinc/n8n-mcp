import { WorkflowNode, WorkflowJson, ReverseConnection, ValidationIssue } from './ai-tool-validators';
export type { WorkflowNode, WorkflowJson, ReverseConnection, ValidationIssue } from './ai-tool-validators';
export declare const AI_CONNECTION_TYPES: readonly ["ai_languageModel", "ai_memory", "ai_tool", "ai_embedding", "ai_vectorStore", "ai_document", "ai_textSplitter", "ai_outputParser"];
export declare function buildReverseConnectionMap(workflow: WorkflowJson): Map<string, ReverseConnection[]>;
export declare function getAIConnections(nodeName: string, reverseConnections: Map<string, ReverseConnection[]>, connectionType?: string): ReverseConnection[];
export interface AIValidationLookups {
    nodeByName(name: string): WorkflowNode | undefined;
    incomingCounts(nodeName: string): Map<string, number>;
    hasMainOutput(nodeName: string): boolean;
    isStreamingTarget(node: WorkflowNode): boolean;
}
export declare function createAIValidationLookups(workflow: WorkflowJson, reverseConnections: Map<string, ReverseConnection[]>): AIValidationLookups;
export declare function validateAIAgent(node: WorkflowNode, reverseConnections: Map<string, ReverseConnection[]>, workflow: WorkflowJson, lookups?: AIValidationLookups): ValidationIssue[];
export declare function validateChatTrigger(node: WorkflowNode, workflow: WorkflowJson, reverseConnections: Map<string, ReverseConnection[]>, lookups?: AIValidationLookups): ValidationIssue[];
export declare function validateBasicLLMChain(node: WorkflowNode, reverseConnections: Map<string, ReverseConnection[]>, lookups?: AIValidationLookups): ValidationIssue[];
export declare function validateAISpecificNodes(workflow: WorkflowJson): ValidationIssue[];
export declare function hasAINodes(workflow: WorkflowJson): boolean;
export declare function getAINodeCategory(nodeType: string): string | null;
//# sourceMappingURL=ai-node-validator.d.ts.map