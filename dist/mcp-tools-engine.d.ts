import { NodeRepository } from './database/node-repository';
import { WorkflowValidationResult } from './services/workflow-validator';
export declare class MCPEngine {
    private repository;
    private workflowValidator;
    constructor(repository: NodeRepository);
    listNodes(args?: any): Promise<any[]>;
    searchNodes(args: any): Promise<any[]>;
    getNodeInfo(args: any): Promise<any>;
    getNodeEssentials(args: any): Promise<{
        nodeType: any;
        displayName: any;
        description: any;
        category: any;
        required: import("./services/property-filter").SimplifiedProperty[];
        common: import("./services/property-filter").SimplifiedProperty[];
    } | null>;
    getNodeDocumentation(args: any): Promise<any>;
    validateNodeOperation(args: any): Promise<import("./services/enhanced-config-validator").EnhancedValidationResult | {
        valid: boolean;
        errors: {
            type: string;
            property: string;
            message: string;
        }[];
        warnings: never[];
        suggestions: never[];
        visibleProperties: never[];
        hiddenProperties: never[];
    }>;
    validateNodeMinimal(args: any): Promise<{
        missingFields: never[];
        error: string;
    } | {
        missingFields: string[];
        error?: undefined;
    }>;
    searchNodeProperties(args: any): Promise<any[]>;
    listAITools(args: any): Promise<any[]>;
    getDatabaseStatistics(args: any): Promise<{
        totalNodes: number;
        aiToolsCount: number;
        categories: string[];
    }>;
    validateWorkflow(args: any): Promise<WorkflowValidationResult>;
}
//# sourceMappingURL=mcp-tools-engine.d.ts.map