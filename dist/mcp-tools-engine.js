"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPEngine = void 0;
const property_filter_1 = require("./services/property-filter");
const enhanced_config_validator_1 = require("./services/enhanced-config-validator");
const workflow_validator_1 = require("./services/workflow-validator");
class MCPEngine {
    constructor(repository) {
        this.repository = repository;
        this.workflowValidator = new workflow_validator_1.WorkflowValidator(repository, enhanced_config_validator_1.EnhancedConfigValidator);
    }
    async listNodes(args = {}) {
        return this.repository.getAllNodes(args.limit);
    }
    async searchNodes(args) {
        return this.repository.searchNodes(args.query, args.mode || 'OR', args.limit || 20);
    }
    async getNodeInfo(args) {
        return this.repository.getNodeByType(args.nodeType);
    }
    async getNodeEssentials(args) {
        const node = await this.repository.getNodeByType(args.nodeType);
        if (!node)
            return null;
        const essentials = property_filter_1.PropertyFilter.getEssentials(node.properties || [], args.nodeType);
        return {
            nodeType: node.nodeType,
            displayName: node.displayName,
            description: node.description,
            category: node.category,
            required: essentials.required,
            common: essentials.common
        };
    }
    async getNodeDocumentation(args) {
        const node = await this.repository.getNodeByType(args.nodeType);
        return node?.documentation || null;
    }
    async validateNodeOperation(args) {
        const node = await this.repository.getNodeByType(args.nodeType);
        if (!node) {
            return {
                valid: false,
                errors: [{ type: 'invalid_configuration', property: '', message: 'Node type not found' }],
                warnings: [],
                suggestions: [],
                visibleProperties: [],
                hiddenProperties: []
            };
        }
        return enhanced_config_validator_1.EnhancedConfigValidator.validateWithMode(args.nodeType, args.config || {}, node.properties || [], args.mode ?? 'operation', args.profile ?? 'ai-friendly');
    }
    async validateNodeMinimal(args) {
        const node = await this.repository.getNodeByType(args.nodeType);
        if (!node) {
            return { missingFields: [], error: 'Node type not found' };
        }
        const missingFields = [];
        const requiredFields = property_filter_1.PropertyFilter.getEssentials(node.properties || [], args.nodeType).required;
        for (const field of requiredFields) {
            if (!args.config[field.name]) {
                missingFields.push(field.name);
            }
        }
        return { missingFields };
    }
    async searchNodeProperties(args) {
        return this.repository.searchNodeProperties(args.nodeType, args.query, args.maxResults || 20);
    }
    async listAITools(args) {
        return this.repository.getAIToolNodes();
    }
    async getDatabaseStatistics(args) {
        const count = await this.repository.getNodeCount();
        const aiTools = await this.repository.getAIToolNodes();
        return {
            totalNodes: count,
            aiToolsCount: aiTools.length,
            categories: ['trigger', 'transform', 'output', 'input']
        };
    }
    async validateWorkflow(args) {
        return this.workflowValidator.validateWorkflow(args.workflow, args.options);
    }
}
exports.MCPEngine = MCPEngine;
//# sourceMappingURL=mcp-tools-engine.js.map