import { INodeParameters } from 'n8n-workflow';
import { WorkflowNode } from '../types/n8n-api';
export declare function sanitizeNode(node: WorkflowNode): WorkflowNode;
export declare function normalizeFixedCollections(nodeType: string, parameters: INodeParameters): INodeParameters;
export declare function sanitizeWorkflowNodes(workflow: any): any;
export declare function validateNodeMetadata(node: WorkflowNode): string[];
//# sourceMappingURL=node-sanitizer.d.ts.map