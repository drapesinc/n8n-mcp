import type { NodeClass } from '../types/node-types';
export declare class PropertyExtractor {
    extractProperties(nodeClass: NodeClass): any[];
    private getNodeDescription;
    extractOperations(nodeClass: NodeClass): any[];
    private extractOperationsFromDescription;
    private declaresToolUse;
    detectAIToolCapability(nodeClass: NodeClass): boolean;
    extractCredentials(nodeClass: NodeClass): any[];
    private normalizeProperties;
}
//# sourceMappingURL=property-extractor.d.ts.map