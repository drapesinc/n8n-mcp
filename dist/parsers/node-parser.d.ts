import type { NodeClass } from '../types/node-types';
export interface ParsedNode {
    style: 'declarative' | 'programmatic';
    nodeType: string;
    displayName: string;
    description?: string;
    category?: string;
    properties: any[];
    credentials: any[];
    isAITool: boolean;
    isTrigger: boolean;
    isWebhook: boolean;
    operations: any[];
    version?: string;
    isVersioned: boolean;
    packageName: string;
    documentation?: string;
    outputs?: any[];
    outputNames?: string[];
    isToolVariant?: boolean;
    toolVariantOf?: string;
    hasToolVariant?: boolean;
}
export interface ParsedNodeVersion {
    nodeType: string;
    version: string;
    packageName: string;
    displayName: string;
    description?: string;
    category?: string;
    isCurrentMax: boolean;
    properties: any[];
    operations: any[];
    credentials: any[];
    outputs?: any[];
    addedProperties: string[];
    deprecatedProperties: string[];
}
export declare function normalizeNodeVersion(version: unknown): string;
export declare class NodeParser {
    private propertyExtractor;
    private currentNodeClass;
    parse(nodeClass: NodeClass, packageName: string): ParsedNode;
    parseVersions(nodeClass: NodeClass, packageName: string): ParsedNodeVersion[];
    private getNodeDescription;
    private detectStyle;
    private extractNodeType;
    private extractCategory;
    private detectTrigger;
    private detectWebhook;
    private extractVersion;
    private detectVersioned;
    private extractOutputs;
}
//# sourceMappingURL=node-parser.d.ts.map