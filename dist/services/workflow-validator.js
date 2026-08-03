"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowValidator = exports.VALID_CONNECTION_TYPES = void 0;
const crypto_1 = __importDefault(require("crypto"));
const expression_validator_1 = require("./expression-validator");
const expression_utils_1 = require("../utils/expression-utils");
const expression_format_validator_1 = require("./expression-format-validator");
const node_similarity_service_1 = require("./node-similarity-service");
const node_type_normalizer_1 = require("../utils/node-type-normalizer");
const typeversion_1 = require("../utils/typeversion");
const logger_1 = require("../utils/logger");
const ai_node_validator_1 = require("./ai-node-validator");
const ai_tool_validators_1 = require("./ai-tool-validators");
const node_type_utils_1 = require("../utils/node-type-utils");
const node_classification_1 = require("../utils/node-classification");
const n8n_validation_1 = require("./n8n-validation");
const node_groups_1 = require("./node-groups");
const tool_variant_generator_1 = require("./tool-variant-generator");
const logger = new logger_1.Logger({ prefix: '[WorkflowValidator]' });
const ADD_ERROR_HANDLING_ADVISORY = 'Consider adding error handling to your workflow';
exports.VALID_CONNECTION_TYPES = new Set([
    'main',
    'error',
    ...ai_node_validator_1.AI_CONNECTION_TYPES,
    'ai_agent',
    'ai_chain',
    'ai_retriever',
    'ai_reranker',
]);
class WorkflowValidator {
    constructor(nodeRepository, nodeValidator) {
        this.nodeRepository = nodeRepository;
        this.nodeValidator = nodeValidator;
        this.currentWorkflow = null;
        this.similarityService = new node_similarity_service_1.NodeSimilarityService(nodeRepository);
    }
    async validateWorkflow(workflow, options = {}) {
        this.currentWorkflow = workflow;
        const { validateNodes = true, validateConnections = true, validateExpressions = true, profile = 'runtime' } = options;
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            statistics: {
                totalNodes: 0,
                enabledNodes: 0,
                triggerNodes: 0,
                validConnections: 0,
                invalidConnections: 0,
                expressionsValidated: 0,
            },
            suggestions: []
        };
        try {
            if (!workflow) {
                result.errors.push({
                    type: 'error',
                    message: 'Invalid workflow structure: workflow is null or undefined'
                });
                result.valid = false;
                return result;
            }
            const executableNodes = Array.isArray(workflow.nodes) ? workflow.nodes.filter(n => !(0, node_classification_1.isNonExecutableNode)(n.type)) : [];
            result.statistics.totalNodes = executableNodes.length;
            result.statistics.enabledNodes = executableNodes.filter(n => !n.disabled).length;
            this.validateWorkflowStructure(workflow, result);
            if (workflow.nodes && Array.isArray(workflow.nodes) && workflow.connections && typeof workflow.connections === 'object') {
                if (validateNodes && workflow.nodes.length > 0) {
                    await this.validateAllNodes(workflow, result, profile);
                }
                if (validateConnections) {
                    this.validateConnections(workflow, result, profile);
                }
                if (validateExpressions && workflow.nodes.length > 0) {
                    this.validateExpressions(workflow, result, profile);
                }
                if (workflow.nodes.length > 0) {
                    this.checkWorkflowPatterns(workflow, result, profile);
                }
                this.validateNodeGroups(workflow, result);
                if (workflow.nodes.length > 0 && (0, ai_node_validator_1.hasAINodes)(workflow)) {
                    const aiIssues = (0, ai_node_validator_1.validateAISpecificNodes)(workflow);
                    for (const issue of aiIssues) {
                        if (issue.severity === 'info') {
                            result.suggestions.push(issue.message);
                            continue;
                        }
                        const validationIssue = {
                            type: issue.severity === 'error' ? 'error' : 'warning',
                            nodeId: issue.nodeId,
                            nodeName: issue.nodeName,
                            message: issue.message,
                            details: issue.code ? { code: issue.code } : undefined
                        };
                        if (issue.severity === 'error') {
                            result.errors.push(validationIssue);
                        }
                        else {
                            result.warnings.push(validationIssue);
                        }
                    }
                }
                this.generateSuggestions(workflow, result, profile);
                if (result.errors.length > 0) {
                    this.addErrorRecoverySuggestions(result);
                }
            }
        }
        catch (error) {
            logger.error('Error validating workflow:', error);
            result.errors.push({
                type: 'error',
                message: `Workflow validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
        result.valid = result.errors.length === 0;
        return result;
    }
    validateNodeGroups(workflow, result) {
        if (!Array.isArray(workflow.nodeGroups) || workflow.nodeGroups.length === 0)
            return;
        const issues = (0, node_groups_1.checkNodeGroups)({ nodes: workflow.nodes, nodeGroups: workflow.nodeGroups }, {
            isTrigger: node => {
                const nodeInfo = this.nodeRepository.getNode(node_type_normalizer_1.NodeTypeNormalizer.normalizeToFullForm(node.type));
                return nodeInfo ? Boolean(nodeInfo.isTrigger) : (0, node_type_utils_1.isTriggerNode)(node.type);
            }
        });
        for (const issue of issues) {
            result.warnings.push({
                type: 'warning',
                code: issue.code,
                message: issue.message,
                details: { group: issue.group }
            });
        }
    }
    validateWorkflowStructure(workflow, result) {
        if (!workflow.nodes) {
            result.errors.push({
                type: 'error',
                message: workflow.nodes === null ? 'nodes must be an array' : 'Workflow must have a nodes array'
            });
            return;
        }
        if (!Array.isArray(workflow.nodes)) {
            result.errors.push({
                type: 'error',
                message: 'nodes must be an array'
            });
            return;
        }
        if (!workflow.connections) {
            result.errors.push({
                type: 'error',
                message: workflow.connections === null ? 'connections must be an object' : 'Workflow must have a connections object'
            });
            return;
        }
        if (typeof workflow.connections !== 'object' || Array.isArray(workflow.connections)) {
            result.errors.push({
                type: 'error',
                message: 'connections must be an object'
            });
            return;
        }
        if (workflow.nodes.length === 0) {
            result.warnings.push({
                type: 'warning',
                message: 'Workflow is empty - no nodes defined'
            });
            return;
        }
        if (workflow.nodes.length === 1) {
            const singleNode = workflow.nodes[0];
            const normalizedType = node_type_normalizer_1.NodeTypeNormalizer.normalizeToFullForm(singleNode.type);
            const isWebhook = normalizedType === 'nodes-base.webhook' ||
                normalizedType === 'nodes-base.webhookTrigger';
            const isLangchainNode = normalizedType.startsWith('nodes-langchain.');
            if (!isWebhook && !isLangchainNode) {
                result.errors.push({
                    type: 'error',
                    message: 'Single-node workflows are only valid for webhook endpoints. Add at least one more connected node to create a functional workflow.'
                });
            }
            else if (isWebhook && Object.keys(workflow.connections).length === 0) {
                result.warnings.push({
                    type: 'warning',
                    message: 'Webhook node has no connections. Consider adding nodes to process the webhook data.'
                });
            }
        }
        if (workflow.nodes.length > 1) {
            const hasEnabledNodes = workflow.nodes.some(n => !n.disabled);
            const hasConnections = Object.keys(workflow.connections).length > 0;
            if (hasEnabledNodes && !hasConnections) {
                result.errors.push({
                    type: 'error',
                    message: 'Multi-node workflow has no connections. Nodes must be connected to create a workflow. Use connections: { "Source Node Name": { "main": [[{ "node": "Target Node Name", "type": "main", "index": 0 }]] } }'
                });
            }
        }
        const nodeNames = new Set();
        const nodeIds = new Set();
        const nodeIdToIndex = new Map();
        for (let i = 0; i < workflow.nodes.length; i++) {
            const node = workflow.nodes[i];
            if (nodeNames.has(node.name)) {
                result.errors.push({
                    type: 'error',
                    nodeId: node.id,
                    nodeName: node.name,
                    message: `Duplicate node name: "${node.name}"`
                });
            }
            nodeNames.add(node.name);
            if (node.id && nodeIds.has(node.id)) {
                const firstNodeIndex = nodeIdToIndex.get(node.id);
                const firstNode = firstNodeIndex !== undefined ? workflow.nodes[firstNodeIndex] : undefined;
                result.errors.push({
                    type: 'error',
                    nodeId: node.id,
                    message: `Duplicate node ID: "${node.id}". Node at index ${i} (name: "${node.name}", type: "${node.type}") conflicts with node at index ${firstNodeIndex} (name: "${firstNode?.name || 'unknown'}", type: "${firstNode?.type || 'unknown'}"). Each node must have a unique ID. Generate a new UUID using crypto.randomUUID() - Example: {id: "${crypto_1.default.randomUUID()}", name: "${node.name}", type: "${node.type}", ...}`
                });
            }
            else if (node.id) {
                nodeIds.add(node.id);
                nodeIdToIndex.set(node.id, i);
            }
        }
        const triggerNodes = workflow.nodes.filter(n => (0, node_type_utils_1.isTriggerNode)(n.type));
        result.statistics.triggerNodes = triggerNodes.length;
        if (triggerNodes.length === 0 && workflow.nodes.filter(n => !n.disabled).length > 0) {
            result.warnings.push({
                type: 'warning',
                message: 'Workflow has no trigger nodes. It can only be executed manually.'
            });
        }
    }
    async validateAllNodes(workflow, result, profile) {
        for (const node of workflow.nodes) {
            if (node.disabled || (0, node_classification_1.isNonExecutableNode)(node.type))
                continue;
            try {
                if (node.name && node.name.length > 255) {
                    result.warnings.push({
                        type: 'warning',
                        nodeId: node.id,
                        nodeName: node.name,
                        message: `Node name is very long (${node.name.length} characters). Consider using a shorter name for better readability.`
                    });
                }
                if (!Array.isArray(node.position) || node.position.length !== 2) {
                    result.errors.push({
                        type: 'error',
                        nodeId: node.id,
                        nodeName: node.name,
                        message: 'Node position must be an array with exactly 2 numbers [x, y]'
                    });
                }
                else {
                    const [x, y] = node.position;
                    if (typeof x !== 'number' || typeof y !== 'number' ||
                        !isFinite(x) || !isFinite(y)) {
                        result.errors.push({
                            type: 'error',
                            nodeId: node.id,
                            nodeName: node.name,
                            message: 'Node position values must be finite numbers'
                        });
                    }
                }
                const normalizedType = node_type_normalizer_1.NodeTypeNormalizer.normalizeToFullForm(node.type);
                let nodeInfo = this.nodeRepository.getNode(normalizedType);
                if (!nodeInfo && tool_variant_generator_1.ToolVariantGenerator.isToolVariantNodeType(normalizedType)) {
                    const baseNodeType = tool_variant_generator_1.ToolVariantGenerator.getBaseNodeType(normalizedType);
                    if (baseNodeType) {
                        const baseNodeInfo = this.nodeRepository.getNode(baseNodeType);
                        if (baseNodeInfo) {
                            result.suggestions.push(`Node type "${node.type}" is inferred as a dynamic AI Tool variant of "${baseNodeType}". ` +
                                `This Tool variant is created by n8n at runtime when connecting "${baseNodeInfo.displayName}" to an AI Agent.`);
                            nodeInfo = {
                                ...baseNodeInfo,
                                nodeType: normalizedType,
                                displayName: `${baseNodeInfo.displayName} Tool`,
                                isToolVariant: true,
                                toolVariantOf: baseNodeType,
                                isInferred: true
                            };
                        }
                    }
                }
                if (!nodeInfo) {
                    const suggestions = await this.similarityService.findSimilarNodes(node.type, 3);
                    const isCommunityType = !this.isCorePackageType(normalizedType) && normalizedType.includes('.');
                    let message = `Unknown node type: "${node.type}".`;
                    if (isCommunityType) {
                        message += ' This looks like a community node that is not in this server\'s node database — the workflow can still run on an n8n instance where the package is installed.';
                    }
                    if (suggestions.length > 0) {
                        message += '\n\nDid you mean one of these?';
                        for (const suggestion of suggestions) {
                            const confidence = Math.round(suggestion.confidence * 100);
                            message += `\n• ${suggestion.nodeType} (${confidence}% match)`;
                            if (suggestion.displayName) {
                                message += ` - ${suggestion.displayName}`;
                            }
                            message += `\n  → ${suggestion.reason}`;
                            if (suggestion.confidence >= 0.9) {
                                message += ' (can be auto-fixed)';
                            }
                        }
                    }
                    else if (!isCommunityType) {
                        message += ' No similar nodes found. Node types must include the package prefix (e.g., "n8n-nodes-base.webhook").';
                    }
                    const issue = {
                        type: isCommunityType ? 'warning' : 'error',
                        nodeId: node.id,
                        nodeName: node.name,
                        message
                    };
                    if (suggestions.length > 0) {
                        issue.suggestions = suggestions.map(s => ({
                            nodeType: s.nodeType,
                            confidence: s.confidence,
                            reason: s.reason
                        }));
                    }
                    if (isCommunityType) {
                        result.warnings.push(issue);
                    }
                    else {
                        result.errors.push(issue);
                    }
                    continue;
                }
                if (nodeInfo.isVersioned) {
                    const maxVersion = (0, typeversion_1.parseTypeVersion)(nodeInfo.version);
                    if (maxVersion === null && nodeInfo.version != null) {
                        result.warnings.push({
                            type: 'warning',
                            nodeId: node.id,
                            nodeName: node.name,
                            message: `Cannot validate typeVersion for ${node.type}: stored version "${nodeInfo.version}" is not a valid typeVersion. Min/max checks were skipped — re-sync this node or verify typeVersion against the node descriptor manually.`
                        });
                    }
                    if (node.typeVersion === undefined || node.typeVersion === null) {
                        result.errors.push({
                            type: 'error',
                            nodeId: node.id,
                            nodeName: node.name,
                            message: `Missing required property 'typeVersion'. Add typeVersion: ${maxVersion ?? 1}`
                        });
                    }
                    else if (typeof node.typeVersion !== 'number' || !Number.isFinite(node.typeVersion) || node.typeVersion < 0) {
                        result.errors.push({
                            type: 'error',
                            nodeId: node.id,
                            nodeName: node.name,
                            message: `Invalid typeVersion: ${node.typeVersion}. Must be a finite non-negative number`
                        });
                    }
                    else if (maxVersion !== null && node.typeVersion < maxVersion) {
                        if (this.isAdvisoryProfile(profile)) {
                            result.suggestions.push(`Outdated typeVersion for node "${node.name}": ${node.typeVersion}. Latest is ${maxVersion}.`);
                        }
                    }
                    else if (maxVersion !== null && node.typeVersion > maxVersion) {
                        if (this.isCorePackageType(normalizedType)) {
                            result.errors.push({
                                type: 'error',
                                nodeId: node.id,
                                nodeName: node.name,
                                message: `typeVersion ${node.typeVersion} exceeds maximum supported version ${maxVersion}`
                            });
                        }
                        else {
                            result.warnings.push({
                                type: 'warning',
                                nodeId: node.id,
                                nodeName: node.name,
                                message: `typeVersion ${node.typeVersion} exceeds maximum supported version ${maxVersion} known to this server. The community package may be newer than this server's data — verify the version exists in your installed package.`
                            });
                        }
                    }
                }
                if (normalizedType.startsWith('nodes-langchain.')) {
                    continue;
                }
                if (nodeInfo.isInferred) {
                    continue;
                }
                const paramsWithVersion = {
                    '@version': node.typeVersion || 1,
                    ...node.parameters
                };
                const nodeValidation = this.nodeValidator.validateWithMode(node.type, paramsWithVersion, nodeInfo.properties || [], 'operation', profile);
                nodeValidation.errors.forEach((error) => {
                    result.errors.push({
                        type: 'error',
                        nodeId: node.id,
                        nodeName: node.name,
                        message: typeof error === 'string' ? error : error.message || String(error)
                    });
                });
                nodeValidation.warnings.forEach((warning) => {
                    result.warnings.push({
                        type: 'warning',
                        nodeId: node.id,
                        nodeName: node.name,
                        message: typeof warning === 'string' ? warning : warning.message || String(warning)
                    });
                });
                if (node.type === 'n8n-nodes-base.if' || node.type === 'n8n-nodes-base.switch') {
                    const conditionErrors = (0, n8n_validation_1.validateConditionNodeStructure)(node);
                    for (const err of conditionErrors) {
                        result.errors.push({
                            type: 'error',
                            nodeId: node.id,
                            nodeName: node.name,
                            message: err
                        });
                    }
                }
            }
            catch (error) {
                result.errors.push({
                    type: 'error',
                    nodeId: node.id,
                    nodeName: node.name,
                    message: `Failed to validate node: ${error instanceof Error ? error.message : 'Unknown error'}`
                });
            }
        }
    }
    validateConnections(workflow, result, profile = 'runtime') {
        const nodeMap = new Map(workflow.nodes.map(n => [n.name, n]));
        const nodeIdMap = new Map(workflow.nodes.map(n => [n.id, n]));
        for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
            const sourceNode = nodeMap.get(sourceName);
            if (!sourceNode) {
                const nodeById = nodeIdMap.get(sourceName);
                if (nodeById) {
                    result.errors.push({
                        type: 'error',
                        nodeId: nodeById.id,
                        nodeName: nodeById.name,
                        message: `Connection uses node ID '${sourceName}' instead of node name '${nodeById.name}'. In n8n, connections must use node names, not IDs.`
                    });
                }
                else {
                    result.errors.push({
                        type: 'error',
                        message: `Connection from non-existent node: "${sourceName}"`
                    });
                }
                result.statistics.invalidConnections++;
                continue;
            }
            for (const [outputKey, outputConnections] of Object.entries(outputs)) {
                if (!exports.VALID_CONNECTION_TYPES.has(outputKey)) {
                    let suggestion = '';
                    if (/^\d+$/.test(outputKey)) {
                        suggestion = ` If you meant to use output index ${outputKey}, use main[${outputKey}] instead.`;
                    }
                    result.errors.push({
                        type: 'error',
                        nodeName: sourceName,
                        message: `Unknown connection output key "${outputKey}" on node "${sourceName}". Valid keys are: ${[...exports.VALID_CONNECTION_TYPES].join(', ')}.${suggestion}`,
                        code: 'UNKNOWN_CONNECTION_KEY'
                    });
                    result.statistics.invalidConnections++;
                    continue;
                }
                if (!outputConnections || !Array.isArray(outputConnections))
                    continue;
                if (outputKey === 'ai_tool') {
                    this.validateAIToolSource(sourceNode, result);
                }
                if (outputKey === 'main') {
                    this.validateNotAISubNode(sourceNode, result);
                }
                this.validateConnectionOutputs(sourceName, outputConnections, nodeMap, nodeIdMap, result, outputKey, profile);
            }
        }
        if (profile !== 'minimal') {
            this.validateTriggerReachability(workflow, result);
        }
        else {
            this.flagOrphanedNodes(workflow, result);
        }
        if (profile !== 'minimal' && this.hasCycle(workflow)) {
            result.warnings.push({
                type: 'warning',
                message: 'Workflow contains a cycle with no recognized exit. Verify the loop can terminate (e.g. via a conditional branch, an error output, or a node that can return zero items).'
            });
        }
    }
    validateConnectionOutputs(sourceName, outputs, nodeMap, nodeIdMap, result, outputType, profile = 'runtime') {
        const sourceNode = nodeMap.get(sourceName);
        if (outputType === 'main' && sourceNode) {
            this.validateErrorOutputConfiguration(sourceName, sourceNode, outputs, nodeMap, result, profile);
            this.validateOutputIndexBounds(sourceNode, outputs, result);
            this.validateConditionalBranchUsage(sourceNode, outputs, result);
        }
        outputs.forEach((outputConnections, outputIndex) => {
            if (!outputConnections)
                return;
            outputConnections.forEach(connection => {
                if (connection.index < 0) {
                    result.errors.push({
                        type: 'error',
                        message: `Invalid connection index ${connection.index} from "${sourceName}". Connection indices must be non-negative.`
                    });
                    result.statistics.invalidConnections++;
                    return;
                }
                if (connection.type && !exports.VALID_CONNECTION_TYPES.has(connection.type)) {
                    let suggestion = '';
                    if (/^\d+$/.test(connection.type)) {
                        suggestion = ` Numeric types are not valid - use "main", "error", or an AI connection type.`;
                    }
                    result.errors.push({
                        type: 'error',
                        nodeName: sourceName,
                        message: `Invalid connection type "${connection.type}" in connection from "${sourceName}" to "${connection.node}". Expected "main", "error", or an AI connection type (ai_tool, ai_languageModel, etc.).${suggestion}`,
                        code: 'INVALID_CONNECTION_TYPE'
                    });
                    result.statistics.invalidConnections++;
                    return;
                }
                const isSplitInBatches = sourceNode && (sourceNode.type === 'n8n-nodes-base.splitInBatches' ||
                    sourceNode.type === 'nodes-base.splitInBatches');
                if (isSplitInBatches) {
                    this.validateSplitInBatchesConnection(sourceNode, outputIndex, connection, nodeMap, result);
                }
                if (connection.node === sourceName) {
                    if (sourceNode && !isSplitInBatches) {
                        result.warnings.push({
                            type: 'warning',
                            message: `Node "${sourceName}" has a self-referencing connection. This can cause infinite loops.`
                        });
                    }
                }
                const targetNode = nodeMap.get(connection.node);
                if (!targetNode) {
                    const nodeById = nodeIdMap.get(connection.node);
                    if (nodeById) {
                        result.errors.push({
                            type: 'error',
                            nodeId: nodeById.id,
                            nodeName: nodeById.name,
                            message: `Connection target uses node ID '${connection.node}' instead of node name '${nodeById.name}' (from ${sourceName}). In n8n, connections must use node names, not IDs.`
                        });
                    }
                    else {
                        result.errors.push({
                            type: 'error',
                            message: `Connection to non-existent node: "${connection.node}" from "${sourceName}"`
                        });
                    }
                    result.statistics.invalidConnections++;
                }
                else if (targetNode.disabled) {
                    result.warnings.push({
                        type: 'warning',
                        message: `Connection to disabled node: "${connection.node}" from "${sourceName}"`
                    });
                }
                else {
                    result.statistics.validConnections++;
                    if (outputType === 'main') {
                        this.validateInputIndexBounds(sourceName, targetNode, connection, result);
                    }
                }
            });
        });
    }
    validateErrorOutputConfiguration(sourceName, sourceNode, outputs, nodeMap, result, profile = 'runtime') {
        const hasErrorOutputSetting = sourceNode.onError === 'continueErrorOutput';
        const errorOutputIndex = this.getMainOutputCount(sourceNode);
        if (errorOutputIndex !== null) {
            const hasErrorConnections = outputs.length > errorOutputIndex &&
                outputs[errorOutputIndex] &&
                outputs[errorOutputIndex].length > 0;
            if (hasErrorOutputSetting && !hasErrorConnections && profile !== 'minimal') {
                result.warnings.push({
                    type: 'warning',
                    nodeId: sourceNode.id,
                    nodeName: sourceNode.name,
                    message: `Node has onError: 'continueErrorOutput' but the error output (main[${errorOutputIndex}]) is not connected — failed items are silently dropped. Connect an error handler to main[${errorOutputIndex}] or change onError to 'continueRegularOutput' or 'stopWorkflow'.`
                });
            }
            if (!hasErrorOutputSetting && hasErrorConnections) {
                result.warnings.push({
                    type: 'warning',
                    nodeId: sourceNode.id,
                    nodeName: sourceNode.name,
                    message: `Node has error output connections in main[${errorOutputIndex}] but missing onError: 'continueErrorOutput'. Add this property to properly handle errors.`
                });
            }
        }
        if (outputs.length >= 1 && outputs[0] && outputs[0].length > 1) {
            const potentialErrorHandlers = outputs[0].filter(conn => {
                const targetNode = nodeMap.get(conn.node);
                if (!targetNode)
                    return false;
                const nodeName = targetNode.name.toLowerCase();
                const nodeType = targetNode.type.toLowerCase();
                return nodeName.includes('error') ||
                    nodeName.includes('fail') ||
                    nodeName.includes('catch') ||
                    nodeName.includes('exception') ||
                    nodeType.includes('respondtowebhook') ||
                    nodeType.includes('emailsend');
            });
            if (potentialErrorHandlers.length > 0) {
                const errorHandlerNames = potentialErrorHandlers.map(conn => `"${conn.node}"`).join(', ');
                result.errors.push({
                    type: 'error',
                    nodeId: sourceNode.id,
                    nodeName: sourceNode.name,
                    message: `Incorrect error output configuration. Nodes ${errorHandlerNames} appear to be error handlers but are in main[0] (success output) along with other nodes.\n\n` +
                        `INCORRECT (current):\n` +
                        `"${sourceName}": {\n` +
                        `  "main": [\n` +
                        `    [  // main[0] has multiple nodes mixed together\n` +
                        outputs[0].map(conn => `      {"node": "${conn.node}", "type": "${conn.type}", "index": ${conn.index}}`).join(',\n') + '\n' +
                        `    ]\n` +
                        `  ]\n` +
                        `}\n\n` +
                        `CORRECT (should be):\n` +
                        `"${sourceName}": {\n` +
                        `  "main": [\n` +
                        `    [  // main[0] = success output\n` +
                        outputs[0].filter(conn => !potentialErrorHandlers.includes(conn)).map(conn => `      {"node": "${conn.node}", "type": "${conn.type}", "index": ${conn.index}}`).join(',\n') + '\n' +
                        `    ],\n` +
                        `    [  // main[1] = error output\n` +
                        potentialErrorHandlers.map(conn => `      {"node": "${conn.node}", "type": "${conn.type}", "index": ${conn.index}}`).join(',\n') + '\n' +
                        `    ]\n` +
                        `  ]\n` +
                        `}\n\n` +
                        `Also add: "onError": "continueErrorOutput" to the "${sourceName}" node.`
                });
            }
        }
    }
    validateAIToolSource(sourceNode, result) {
        const normalizedType = node_type_normalizer_1.NodeTypeNormalizer.normalizeToFullForm(sourceNode.type);
        if ((0, ai_tool_validators_1.isAIToolSubNode)(normalizedType)) {
            return;
        }
        const nodeInfo = this.nodeRepository.getNode(normalizedType);
        if (nodeInfo?.isCommunity) {
            this.pushCommunityToolUsageWarning(sourceNode, result);
        }
        if (tool_variant_generator_1.ToolVariantGenerator.isToolVariantNodeType(normalizedType)) {
            if (nodeInfo?.isToolVariant) {
                return;
            }
        }
        if (!nodeInfo) {
            if (!this.isCorePackageType(normalizedType) && normalizedType.includes('.')) {
                this.pushCommunityToolUsageWarning(sourceNode, result);
            }
            return;
        }
        const aiToolOutputExpression = this.findConditionalAIToolExpression(nodeInfo.outputs);
        if (aiToolOutputExpression) {
            this.validateConditionalAIToolMode(sourceNode, aiToolOutputExpression, result);
            return;
        }
        if (nodeInfo.hasToolVariant) {
            const toolVariantType = tool_variant_generator_1.ToolVariantGenerator.getToolVariantNodeType(normalizedType);
            const workflowToolVariantType = node_type_normalizer_1.NodeTypeNormalizer.toWorkflowFormat(toolVariantType);
            result.errors.push({
                type: 'error',
                nodeId: sourceNode.id,
                nodeName: sourceNode.name,
                message: `Node "${sourceNode.name}" uses "${sourceNode.type}" which cannot output ai_tool connections. ` +
                    `Use the Tool variant "${workflowToolVariantType}" instead for AI Agent integration.`,
                code: 'WRONG_NODE_TYPE_FOR_AI_TOOL',
                fix: {
                    type: 'tool-variant-correction',
                    currentType: sourceNode.type,
                    suggestedType: workflowToolVariantType,
                    description: `Change node type from "${sourceNode.type}" to "${workflowToolVariantType}"`
                }
            });
            return;
        }
        if (nodeInfo.isAITool) {
            return;
        }
        result.errors.push({
            type: 'error',
            nodeId: sourceNode.id,
            nodeName: sourceNode.name,
            message: `Node "${sourceNode.name}" of type "${sourceNode.type}" cannot output ai_tool connections. ` +
                `Only AI tool nodes (e.g., Calculator, HTTP Request Tool) or Tool variants (e.g., *Tool suffix nodes) can be connected to AI Agents as tools.`,
            code: 'INVALID_AI_TOOL_SOURCE'
        });
    }
    pushCommunityToolUsageWarning(sourceNode, result) {
        result.warnings.push({
            type: 'warning',
            nodeId: sourceNode.id,
            nodeName: sourceNode.name,
            message: `Community node "${sourceNode.name}" is being used as an AI tool. Ensure N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true is set on the n8n instance.`
        });
    }
    findConditionalAIToolExpression(outputs) {
        const candidates = Array.isArray(outputs) ? outputs :
            typeof outputs === 'string' ? [outputs] :
                [];
        return candidates.find((output) => typeof output === 'string' && output.startsWith('={{') && output.includes('ai_tool')) ?? null;
    }
    validateConditionalAIToolMode(sourceNode, outputExpression, result) {
        if (!outputExpression.includes('retrieve-as-tool'))
            return;
        const mode = sourceNode.parameters?.mode;
        const isUnset = mode === undefined || mode === null;
        const isStaticMode = isUnset || (typeof mode === 'string' && !mode.startsWith('='));
        if (!isStaticMode || mode === 'retrieve-as-tool')
            return;
        if (isUnset) {
            const defaultMode = outputExpression.match(/\?\?\s*'([^']+)'/)?.[1];
            if (defaultMode === undefined || defaultMode === 'retrieve-as-tool')
                return;
        }
        result.warnings.push({
            type: 'warning',
            nodeId: sourceNode.id,
            nodeName: sourceNode.name,
            message: `Node "${sourceNode.name}" connects to an AI Agent as a tool, but its ai_tool output only exists when mode is "retrieve-as-tool"` +
                (isUnset ? ' (mode is not set, so the default applies)' : ` (current mode: "${mode}")`) +
                `. Set mode to "retrieve-as-tool".`,
            code: 'AI_TOOL_MODE_MISMATCH'
        });
    }
    getNodeOutputTypes(nodeType) {
        const normalizedType = node_type_normalizer_1.NodeTypeNormalizer.normalizeToFullForm(nodeType);
        const nodeInfo = this.nodeRepository.getNode(normalizedType);
        if (!nodeInfo || !nodeInfo.outputs)
            return null;
        const outputs = nodeInfo.outputs;
        if (!Array.isArray(outputs))
            return null;
        for (const output of outputs) {
            if (typeof output === 'string' && output.startsWith('={{')) {
                return null;
            }
        }
        return outputs;
    }
    validateNotAISubNode(sourceNode, result) {
        const outputTypes = this.getNodeOutputTypes(sourceNode.type);
        if (!outputTypes)
            return;
        const hasMainOutput = outputTypes.some(t => t === 'main');
        if (hasMainOutput)
            return;
        const aiTypes = outputTypes.filter(t => t !== 'main');
        const expectedType = aiTypes[0] || 'ai_languageModel';
        result.errors.push({
            type: 'error',
            nodeId: sourceNode.id,
            nodeName: sourceNode.name,
            message: `Node "${sourceNode.name}" (${sourceNode.type}) is an AI sub-node that outputs "${expectedType}" connections. ` +
                `It cannot be used with "main" connections. Connect it to an AI Agent or Chain via "${expectedType}" instead.`,
            code: 'AI_SUBNODE_MAIN_CONNECTION'
        });
    }
    getShortNodeType(sourceNode) {
        const normalizedType = node_type_normalizer_1.NodeTypeNormalizer.normalizeToFullForm(sourceNode.type);
        return normalizedType.replace(/^(n8n-)?nodes-base\./, '');
    }
    isCorePackageType(normalizedType) {
        return normalizedType.startsWith('nodes-base.') || normalizedType.startsWith('nodes-langchain.');
    }
    isAdvisoryProfile(profile) {
        return profile === 'ai-friendly' || profile === 'strict';
    }
    getMainOutputCount(sourceNode) {
        const normalizedType = node_type_normalizer_1.NodeTypeNormalizer.normalizeToFullForm(sourceNode.type);
        const nodeInfo = this.nodeRepository.getNode(normalizedType);
        if (!nodeInfo || !nodeInfo.outputs)
            return null;
        if (!Array.isArray(nodeInfo.outputs))
            return null;
        const mainOutputCount = nodeInfo.outputs.filter((o) => typeof o === 'string' ? o === 'main' : (o.type === 'main' || !o.type)).length;
        if (mainOutputCount === 0)
            return null;
        const conditionalInfo = this.getConditionalOutputInfo(sourceNode);
        if (conditionalInfo) {
            return conditionalInfo.expectedOutputs;
        }
        if (this.getShortNodeType(sourceNode) === 'switch') {
            return null;
        }
        return mainOutputCount;
    }
    getConditionalOutputInfo(sourceNode) {
        const shortType = this.getShortNodeType(sourceNode);
        if (shortType === 'if' || shortType === 'filter') {
            return { shortType, expectedOutputs: 2 };
        }
        if (shortType === 'switch') {
            const rules = sourceNode.parameters?.rules?.values || sourceNode.parameters?.rules;
            if (Array.isArray(rules)) {
                return { shortType, expectedOutputs: rules.length + 1 };
            }
            return null;
        }
        return null;
    }
    validateOutputIndexBounds(sourceNode, outputs, result) {
        const naturalOutputCount = this.getMainOutputCount(sourceNode);
        if (naturalOutputCount === null)
            return;
        let mainOutputCount = naturalOutputCount;
        if (sourceNode.onError === 'continueErrorOutput') {
            mainOutputCount += 1;
        }
        const maxOutputIndex = outputs.length - 1;
        if (maxOutputIndex >= mainOutputCount) {
            for (let i = mainOutputCount; i < outputs.length; i++) {
                if (outputs[i] && outputs[i].length > 0) {
                    result.errors.push({
                        type: 'error',
                        nodeId: sourceNode.id,
                        nodeName: sourceNode.name,
                        message: `Output index ${i} on node "${sourceNode.name}" exceeds its output count (${mainOutputCount}). ` +
                            `This node has ${mainOutputCount} main output(s) (indices 0-${mainOutputCount - 1}).`,
                        code: 'OUTPUT_INDEX_OUT_OF_BOUNDS'
                    });
                    result.statistics.invalidConnections++;
                }
            }
        }
    }
    validateConditionalBranchUsage(sourceNode, outputs, result) {
        const conditionalInfo = this.getConditionalOutputInfo(sourceNode);
        if (!conditionalInfo || conditionalInfo.expectedOutputs < 2)
            return;
        const { shortType, expectedOutputs } = conditionalInfo;
        const main0Count = outputs[0]?.length || 0;
        if (main0Count < 2)
            return;
        const hasHigherIndexConnections = outputs.slice(1).some(conns => conns && conns.length > 0);
        if (hasHigherIndexConnections)
            return;
        let message;
        if (shortType === 'if' || shortType === 'filter') {
            const isFilter = shortType === 'filter';
            const displayName = isFilter ? 'Filter' : 'IF';
            const trueLabel = isFilter ? 'matched' : 'true';
            const falseLabel = isFilter ? 'unmatched' : 'false';
            message = `${displayName} node "${sourceNode.name}" has ${main0Count} connections on the "${trueLabel}" branch (main[0]) ` +
                `but no connections on the "${falseLabel}" branch (main[1]). ` +
                `All ${main0Count} target nodes execute together on the "${trueLabel}" branch, ` +
                `while the "${falseLabel}" branch has no effect. ` +
                `Split connections: main[0] for ${trueLabel}, main[1] for ${falseLabel}.`;
        }
        else {
            message = `Switch node "${sourceNode.name}" has ${main0Count} connections on output 0 ` +
                `but no connections on any other outputs (1-${expectedOutputs - 1}). ` +
                `All ${main0Count} target nodes execute together on output 0, ` +
                `while other switch branches have no effect. ` +
                `Distribute connections across outputs to match switch rules.`;
        }
        result.warnings.push({
            type: 'warning',
            nodeId: sourceNode.id,
            nodeName: sourceNode.name,
            message,
            code: 'CONDITIONAL_BRANCH_FANOUT'
        });
    }
    validateInputIndexBounds(sourceName, targetNode, connection, result) {
        const normalizedType = node_type_normalizer_1.NodeTypeNormalizer.normalizeToFullForm(targetNode.type);
        const nodeInfo = this.nodeRepository.getNode(normalizedType);
        if (!nodeInfo)
            return;
        const shortType = normalizedType.replace(/^(n8n-)?nodes-base\./, '');
        if (nodeInfo.isTrigger || (0, node_type_utils_1.isTriggerNode)(targetNode.type)) {
            if (connection.index >= 0) {
                result.errors.push({
                    type: 'error',
                    nodeName: targetNode.name,
                    message: `Input index ${connection.index} on node "${targetNode.name}" exceeds its input count (0). ` +
                        `Connection from "${sourceName}" targets input ${connection.index}, but trigger nodes have no main inputs.`,
                    code: 'INPUT_INDEX_OUT_OF_BOUNDS'
                });
                result.statistics.invalidConnections++;
            }
            return;
        }
        if (shortType === 'merge' || shortType === 'compareDatasets') {
            const rawInputs = targetNode.parameters?.numberInputs;
            if (rawInputs != null && rawInputs !== '') {
                if (typeof rawInputs === 'string' && rawInputs.trim().startsWith('=')) {
                    return;
                }
                const parsed = Number(rawInputs);
                if (!Number.isFinite(parsed) || parsed <= 0) {
                    return;
                }
                if (connection.index >= parsed) {
                    result.errors.push({
                        type: 'error',
                        nodeName: targetNode.name,
                        message: `Input index ${connection.index} on node "${targetNode.name}" exceeds its input count (${parsed}). ` +
                            `Connection from "${sourceName}" targets input ${connection.index}, but this node has ${parsed} main input(s) (indices 0-${parsed - 1}).`,
                        code: 'INPUT_INDEX_OUT_OF_BOUNDS'
                    });
                    result.statistics.invalidConnections++;
                }
                return;
            }
            const defaultInputs = 2;
            if (connection.index >= defaultInputs) {
                result.warnings.push({
                    type: 'warning',
                    nodeName: targetNode.name,
                    message: `Input index ${connection.index} on node "${targetNode.name}" exceeds the default input count (${defaultInputs}) — ` +
                        `numberInputs is not set, so n8n will ignore this connection and drop items from "${sourceName}". ` +
                        `Set numberInputs to at least ${connection.index + 1} to use this input.`,
                    code: 'MERGE_EXTRA_INPUTS_IGNORED'
                });
            }
            return;
        }
    }
    flagOrphanedNodes(workflow, result) {
        const connectedNodes = new Set();
        for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
            connectedNodes.add(sourceName);
            for (const outputConns of Object.values(outputs)) {
                if (!Array.isArray(outputConns))
                    continue;
                for (const conns of outputConns) {
                    if (!conns)
                        continue;
                    for (const conn of conns) {
                        if (conn)
                            connectedNodes.add(conn.node);
                    }
                }
            }
        }
        for (const node of workflow.nodes) {
            if (node.disabled || (0, node_classification_1.isNonExecutableNode)(node.type))
                continue;
            if ((0, node_type_utils_1.isTriggerNode)(node.type))
                continue;
            if (!connectedNodes.has(node.name)) {
                result.warnings.push({
                    type: 'warning',
                    nodeId: node.id,
                    nodeName: node.name,
                    message: 'Node is not connected to any other nodes'
                });
            }
        }
    }
    validateTriggerReachability(workflow, result) {
        const adjacency = new Map();
        for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
            if (!adjacency.has(sourceName))
                adjacency.set(sourceName, new Set());
            for (const [connectionType, outputConns] of Object.entries(outputs)) {
                if (Array.isArray(outputConns)) {
                    for (const conns of outputConns) {
                        if (!conns)
                            continue;
                        for (const conn of conns) {
                            if (conn) {
                                adjacency.get(sourceName).add(conn.node);
                                if (!adjacency.has(conn.node))
                                    adjacency.set(conn.node, new Set());
                                if (connectionType.startsWith('ai_')) {
                                    adjacency.get(conn.node).add(sourceName);
                                }
                            }
                        }
                    }
                }
            }
        }
        const triggerNodes = [];
        for (const node of workflow.nodes) {
            if ((0, node_type_utils_1.isTriggerNode)(node.type) && !node.disabled) {
                triggerNodes.push(node.name);
            }
        }
        if (triggerNodes.length === 0) {
            this.flagOrphanedNodes(workflow, result);
            return;
        }
        const reachable = new Set();
        const queue = [...triggerNodes];
        for (const t of triggerNodes)
            reachable.add(t);
        while (queue.length > 0) {
            const current = queue.shift();
            const neighbors = adjacency.get(current);
            if (neighbors) {
                for (const neighbor of neighbors) {
                    if (!reachable.has(neighbor)) {
                        reachable.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }
        }
        for (const node of workflow.nodes) {
            if (node.disabled || (0, node_classification_1.isNonExecutableNode)(node.type))
                continue;
            if ((0, node_type_utils_1.isTriggerNode)(node.type))
                continue;
            if (!reachable.has(node.name)) {
                result.warnings.push({
                    type: 'warning',
                    nodeId: node.id,
                    nodeName: node.name,
                    message: 'Node is not reachable from any trigger node'
                });
            }
        }
    }
    hasCycle(workflow) {
        const visited = new Set();
        const recursionStack = new Set();
        const path = [];
        const nodeTypeMap = new Map();
        const nodeMap = new Map();
        workflow.nodes.forEach(node => {
            if (!(0, node_classification_1.isNonExecutableNode)(node.type)) {
                nodeTypeMap.set(node.name, node.type);
                nodeMap.set(node.name, node);
            }
        });
        const loopNodeTypes = [
            'n8n-nodes-base.splitInBatches',
            'nodes-base.splitInBatches',
            'n8n-nodes-base.itemLists',
            'nodes-base.itemLists',
            'n8n-nodes-base.loop',
            'nodes-base.loop'
        ];
        const conditionalNodeTypes = [
            'n8n-nodes-base.if',
            'nodes-base.if',
            'n8n-nodes-base.switch',
            'nodes-base.switch',
            'n8n-nodes-base.filter',
            'nodes-base.filter',
            '@n8n/n8n-nodes-langchain.textClassifier',
            'n8n-nodes-langchain.textClassifier',
            'nodes-langchain.textClassifier',
        ];
        const isPotentialCycleExit = (nodeName) => {
            const nodeType = nodeTypeMap.get(nodeName) || '';
            if (loopNodeTypes.includes(nodeType) || conditionalNodeTypes.includes(nodeType)) {
                return true;
            }
            const node = nodeMap.get(nodeName);
            if (node?.onError === 'continueErrorOutput')
                return true;
            const connections = workflow.connections[nodeName];
            const mainOutputs = connections?.main;
            if (Array.isArray(mainOutputs)) {
                const wiredOutputs = mainOutputs.filter(conns => Array.isArray(conns) && conns.length > 0).length;
                if (wiredOutputs > 1)
                    return true;
            }
            const outputCount = node ? this.getMainOutputCount(node) : null;
            return outputCount !== null && outputCount > 1;
        };
        const hasCycleDFS = (nodeName) => {
            visited.add(nodeName);
            recursionStack.add(nodeName);
            path.push(nodeName);
            const connections = workflow.connections[nodeName];
            if (connections) {
                const allTargets = [];
                for (const outputConns of Object.values(connections)) {
                    if (Array.isArray(outputConns)) {
                        outputConns.flat().forEach(conn => {
                            if (conn)
                                allTargets.push(conn.node);
                        });
                    }
                }
                for (const target of allTargets) {
                    if (!visited.has(target)) {
                        if (hasCycleDFS(target))
                            return true;
                    }
                    else if (recursionStack.has(target)) {
                        const cycleNodes = path.slice(path.indexOf(target));
                        if (!cycleNodes.some(isPotentialCycleExit)) {
                            return true;
                        }
                    }
                }
            }
            recursionStack.delete(nodeName);
            path.pop();
            return false;
        };
        for (const node of workflow.nodes) {
            if (!(0, node_classification_1.isNonExecutableNode)(node.type) && !visited.has(node.name)) {
                if (hasCycleDFS(node.name))
                    return true;
            }
        }
        return false;
    }
    validateExpressions(workflow, result, profile = 'runtime') {
        const nodeNames = workflow.nodes.map(n => n.name);
        for (const node of workflow.nodes) {
            if (node.disabled || (0, node_classification_1.isNonExecutableNode)(node.type))
                continue;
            const normalizedType = node_type_normalizer_1.NodeTypeNormalizer.normalizeToFullForm(node.type);
            if (normalizedType.startsWith('nodes-langchain.')) {
                continue;
            }
            const context = {
                availableNodes: nodeNames.filter(n => n !== node.name),
                currentNodeName: node.name,
                hasInputData: this.nodeHasInput(node.name, workflow),
                isInLoop: false
            };
            const exprValidation = expression_validator_1.ExpressionValidator.validateNodeExpressions(node.parameters, context);
            const expressionCount = this.countExpressionsInObject(node.parameters);
            result.statistics.expressionsValidated += expressionCount;
            exprValidation.errors.forEach(error => {
                result.errors.push({
                    type: 'error',
                    nodeId: node.id,
                    nodeName: node.name,
                    message: `Expression error: ${error}`
                });
            });
            exprValidation.warnings.forEach(warning => {
                result.warnings.push({
                    type: 'warning',
                    nodeId: node.id,
                    nodeName: node.name,
                    message: `Expression warning: ${warning}`
                });
            });
            const formatContext = {
                nodeType: node.type,
                nodeName: node.name,
                nodeId: node.id
            };
            const formatIssues = expression_format_validator_1.ExpressionFormatValidator.validateNodeParameters(node.parameters, formatContext, profile);
            formatIssues.forEach(issue => {
                const formattedMessage = expression_format_validator_1.ExpressionFormatValidator.formatErrorMessage(issue, formatContext);
                if (issue.severity === 'error') {
                    result.errors.push({
                        type: 'error',
                        nodeId: node.id,
                        nodeName: node.name,
                        message: formattedMessage
                    });
                }
                else {
                    result.warnings.push({
                        type: 'warning',
                        nodeId: node.id,
                        nodeName: node.name,
                        message: formattedMessage
                    });
                }
            });
        }
    }
    countExpressionsInObject(obj) {
        let count = 0;
        if (typeof obj === 'string') {
            count += (0, expression_utils_1.extractBracketExpressions)(obj).length;
        }
        else if (Array.isArray(obj)) {
            for (const item of obj) {
                count += this.countExpressionsInObject(item);
            }
        }
        else if (obj && typeof obj === 'object') {
            for (const value of Object.values(obj)) {
                count += this.countExpressionsInObject(value);
            }
        }
        return count;
    }
    nodeHasInput(nodeName, workflow) {
        for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
            if (outputs.main) {
                for (const outputConnections of outputs.main) {
                    if (outputConnections?.some(conn => conn.node === nodeName)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    checkWorkflowPatterns(workflow, result, profile = 'runtime') {
        const advisoryProfile = this.isAdvisoryProfile(profile);
        if (advisoryProfile && workflow.nodes.length > 3 && !this.workflowHasErrorHandling(workflow)) {
            result.warnings.push({
                type: 'warning',
                message: ADD_ERROR_HANDLING_ADVISORY
            });
        }
        for (const node of workflow.nodes) {
            if (!(0, node_classification_1.isNonExecutableNode)(node.type)) {
                this.checkNodeErrorHandling(node, workflow, result, profile);
            }
        }
        if (advisoryProfile) {
            const linearChainLength = this.getLongestLinearChain(workflow);
            if (linearChainLength > 10) {
                result.suggestions.push(`Long linear chain detected (${linearChainLength} nodes). Consider breaking into sub-workflows.`);
            }
        }
        this.generateErrorHandlingSuggestions(workflow, result);
        for (const node of workflow.nodes) {
            if (node.credentials && Object.keys(node.credentials).length > 0) {
                for (const [credType, credConfig] of Object.entries(node.credentials)) {
                    if (!credConfig || (typeof credConfig === 'object' && !('id' in credConfig))) {
                        result.warnings.push({
                            type: 'warning',
                            nodeId: node.id,
                            nodeName: node.name,
                            message: `Missing credentials configuration for ${credType}`
                        });
                    }
                }
            }
        }
    }
    workflowHasErrorHandling(workflow) {
        return workflow.nodes.some(node => {
            if (node.disabled)
                return false;
            if (node.type.toLowerCase().includes('errortrigger'))
                return true;
            if (node.continueOnFail === true || node.retryOnFail === true)
                return true;
            if (node.onError === undefined || node.onError === 'stopWorkflow')
                return false;
            if (node.onError !== 'continueErrorOutput')
                return true;
            const mainOutputs = workflow.connections[node.name]?.main;
            if (!Array.isArray(mainOutputs))
                return false;
            const errorOutputIndex = this.getMainOutputCount(node);
            if (errorOutputIndex === null) {
                return mainOutputs.some(conns => Array.isArray(conns) && conns.length > 0);
            }
            const errorConnections = mainOutputs[errorOutputIndex];
            return Array.isArray(errorConnections) && errorConnections.length > 0;
        });
    }
    nodeExecutesOnMainBranch(node) {
        const normalizedType = node_type_normalizer_1.NodeTypeNormalizer.normalizeToFullForm(node.type);
        if ((0, ai_tool_validators_1.isAIToolSubNode)(normalizedType) || tool_variant_generator_1.ToolVariantGenerator.isToolVariantNodeType(normalizedType)) {
            return false;
        }
        const nodeInfo = this.nodeRepository.getNode(normalizedType);
        if (nodeInfo?.isToolVariant)
            return false;
        if (!nodeInfo || nodeInfo.outputs == null)
            return true;
        if (!Array.isArray(nodeInfo.outputs))
            return true;
        return nodeInfo.outputs.some((o) => typeof o === 'string' ? o === 'main' : (o.type === 'main' || !o.type));
    }
    getLongestLinearChain(workflow) {
        const memo = new Map();
        const visiting = new Set();
        const getChainLength = (nodeName) => {
            if (visiting.has(nodeName))
                return 0;
            if (memo.has(nodeName))
                return memo.get(nodeName);
            visiting.add(nodeName);
            let maxLength = 0;
            const connections = workflow.connections[nodeName];
            if (connections?.main) {
                for (const outputConnections of connections.main) {
                    if (outputConnections) {
                        for (const conn of outputConnections) {
                            const length = getChainLength(conn.node);
                            maxLength = Math.max(maxLength, length);
                        }
                    }
                }
            }
            visiting.delete(nodeName);
            const result = maxLength + 1;
            memo.set(nodeName, result);
            return result;
        };
        let maxChain = 0;
        for (const node of workflow.nodes) {
            if (!this.nodeHasInput(node.name, workflow)) {
                maxChain = Math.max(maxChain, getChainLength(node.name));
            }
        }
        return maxChain;
    }
    generateSuggestions(workflow, result, profile = 'runtime') {
        if (result.statistics.triggerNodes === 0) {
            result.suggestions.push('Add a trigger node (e.g., Webhook, Schedule Trigger) to automate workflow execution');
        }
        const hasConnectionErrors = result.errors.some(e => typeof e.message === 'string' && (e.message.includes('connection') ||
            e.message.includes('Connection') ||
            e.message.includes('Multi-node workflow has no connections')));
        if (hasConnectionErrors) {
            result.suggestions.push('Example connection structure: connections: { "Manual Trigger": { "main": [[{ "node": "Set", "type": "main", "index": 0 }]] } }');
            result.suggestions.push('Remember: Use node NAMES (not IDs) in connections. The name is what you see in the UI, not the node type.');
        }
        const alreadyWarnedAboutErrorHandling = result.warnings.some(w => w.message === ADD_ERROR_HANDLING_ADVISORY);
        if (profile !== 'minimal' &&
            !alreadyWarnedAboutErrorHandling &&
            !this.workflowHasErrorHandling(workflow)) {
            result.suggestions.push('Add error handling using the error output of nodes or an Error Trigger node');
        }
        if (workflow.nodes.length > 20) {
            result.suggestions.push('Consider breaking this workflow into smaller sub-workflows for better maintainability');
        }
        const complexExpressionNodes = workflow.nodes.filter(node => {
            const jsonString = JSON.stringify(node.parameters);
            const expressionCount = (jsonString.match(/\{\{/g) || []).length;
            return expressionCount > 5;
        });
        if (complexExpressionNodes.length > 0) {
            result.suggestions.push('Consider using a Code node for complex data transformations instead of multiple expressions');
        }
        if (workflow.nodes.length === 1 && Object.keys(workflow.connections).length === 0) {
            result.suggestions.push('A minimal workflow needs: 1) A trigger node (e.g., Manual Trigger), 2) An action node (e.g., Set, HTTP Request), 3) A connection between them');
        }
    }
    checkNodeErrorHandling(node, workflow, result, profile = 'runtime') {
        if (node.disabled === true)
            return;
        const errorProneNodeTypes = [
            'httprequest',
            'webhook',
            'emailsend',
            'slack',
            'discord',
            'telegram',
            'postgres',
            'mysql',
            'mongodb',
            'redis',
            'github',
            'gitlab',
            'jira',
            'salesforce',
            'hubspot',
            'airtable',
            'googlesheets',
            'googledrive',
            'dropbox',
            's3',
            'ftp',
            'ssh',
            'mqtt',
            'kafka',
            'rabbitmq',
            'graphql',
            'openai',
            'anthropic'
        ];
        const normalizedType = node.type.toLowerCase();
        const isErrorProne = errorProneNodeTypes.some(type => normalizedType.includes(type));
        const nodeLevelProps = [
            'onError', 'continueOnFail', 'retryOnFail', 'maxTries', 'waitBetweenTries', 'alwaysOutputData',
            'executeOnce', 'disabled', 'notes', 'notesInFlow', 'credentials'
        ];
        const misplacedProps = [];
        if (node.parameters) {
            for (const prop of nodeLevelProps) {
                if (node.parameters[prop] !== undefined) {
                    misplacedProps.push(prop);
                }
            }
        }
        if (misplacedProps.length > 0) {
            result.errors.push({
                type: 'error',
                nodeId: node.id,
                nodeName: node.name,
                message: `Node-level properties ${misplacedProps.join(', ')} are in the wrong location. They must be at the node level, not inside parameters.`,
                details: {
                    fix: `Move these properties from node.parameters to the node level. Example:\n` +
                        `{\n` +
                        `  "name": "${node.name}",\n` +
                        `  "type": "${node.type}",\n` +
                        `  "parameters": { /* operation-specific params */ },\n` +
                        `  "onError": "continueErrorOutput",  // ✅ Correct location\n` +
                        `  "retryOnFail": true,               // ✅ Correct location\n` +
                        `  "executeOnce": true,               // ✅ Correct location\n` +
                        `  "disabled": false,                 // ✅ Correct location\n` +
                        `  "credentials": { /* ... */ }       // ✅ Correct location\n` +
                        `}`
                }
            });
        }
        if (node.onError !== undefined) {
            const validOnErrorValues = ['continueRegularOutput', 'continueErrorOutput', 'stopWorkflow'];
            if (!validOnErrorValues.includes(node.onError)) {
                result.errors.push({
                    type: 'error',
                    nodeId: node.id,
                    nodeName: node.name,
                    message: `Invalid onError value: "${node.onError}". Must be one of: ${validOnErrorValues.join(', ')}`
                });
            }
        }
        if (node.continueOnFail !== undefined) {
            if (typeof node.continueOnFail !== 'boolean') {
                result.errors.push({
                    type: 'error',
                    nodeId: node.id,
                    nodeName: node.name,
                    message: 'continueOnFail must be a boolean value'
                });
            }
            else if (node.continueOnFail === true) {
                result.warnings.push({
                    type: 'warning',
                    nodeId: node.id,
                    nodeName: node.name,
                    message: 'Using deprecated "continueOnFail: true". Use "onError: \'continueRegularOutput\'" instead for better control and UI compatibility.'
                });
            }
        }
        if (node.continueOnFail !== undefined && node.onError !== undefined) {
            result.errors.push({
                type: 'error',
                nodeId: node.id,
                nodeName: node.name,
                message: 'Cannot use both "continueOnFail" and "onError" properties. Use only "onError" for modern workflows.'
            });
        }
        if (node.retryOnFail !== undefined) {
            if (typeof node.retryOnFail !== 'boolean') {
                result.errors.push({
                    type: 'error',
                    nodeId: node.id,
                    nodeName: node.name,
                    message: 'retryOnFail must be a boolean value'
                });
            }
            if (node.retryOnFail === true) {
                if (node.maxTries !== undefined) {
                    if (typeof node.maxTries !== 'number' || node.maxTries < 1) {
                        result.errors.push({
                            type: 'error',
                            nodeId: node.id,
                            nodeName: node.name,
                            message: 'maxTries must be a positive number when retryOnFail is enabled'
                        });
                    }
                    else if (node.maxTries > 10) {
                        result.warnings.push({
                            type: 'warning',
                            nodeId: node.id,
                            nodeName: node.name,
                            message: `maxTries is set to ${node.maxTries}. Consider if this many retries is necessary.`
                        });
                    }
                }
                if (node.waitBetweenTries !== undefined) {
                    if (typeof node.waitBetweenTries !== 'number' || node.waitBetweenTries < 0) {
                        result.errors.push({
                            type: 'error',
                            nodeId: node.id,
                            nodeName: node.name,
                            message: 'waitBetweenTries must be a non-negative number (milliseconds)'
                        });
                    }
                    else if (node.waitBetweenTries > 300000) {
                        result.warnings.push({
                            type: 'warning',
                            nodeId: node.id,
                            nodeName: node.name,
                            message: `waitBetweenTries is set to ${node.waitBetweenTries}ms (${(node.waitBetweenTries / 1000).toFixed(1)}s). This seems excessive.`
                        });
                    }
                }
            }
        }
        if (node.alwaysOutputData !== undefined && typeof node.alwaysOutputData !== 'boolean') {
            result.errors.push({
                type: 'error',
                nodeId: node.id,
                nodeName: node.name,
                message: 'alwaysOutputData must be a boolean value'
            });
        }
        const hasErrorHandling = (node.onError && node.onError !== 'stopWorkflow') ||
            node.continueOnFail || node.retryOnFail;
        const advisoryProfile = this.isAdvisoryProfile(profile);
        if (isErrorProne && !hasErrorHandling && advisoryProfile) {
            const nodeTypeSimple = normalizedType.split('.').pop() || normalizedType;
            if (normalizedType.includes('webhook')) {
                this.checkWebhookErrorHandling(node, normalizedType, result);
            }
            else if (!this.nodeExecutesOnMainBranch(node) || (0, node_type_utils_1.isTriggerNode)(node.type)) {
            }
            else if (normalizedType.includes('httprequest')) {
                result.warnings.push({
                    type: 'warning',
                    nodeId: node.id,
                    nodeName: node.name,
                    message: 'HTTP Request node without error handling. Consider adding "onError: \'continueRegularOutput\'" for non-critical requests or "retryOnFail: true" for transient failures.'
                });
            }
            else if (errorProneNodeTypes.some(db => normalizedType.includes(db) && ['postgres', 'mysql', 'mongodb'].includes(db))) {
                result.warnings.push({
                    type: 'warning',
                    nodeId: node.id,
                    nodeName: node.name,
                    message: `Database operation without error handling. Consider adding "retryOnFail: true" for connection issues or "onError: \'continueRegularOutput\'" for non-critical queries.`
                });
            }
            else {
                result.warnings.push({
                    type: 'warning',
                    nodeId: node.id,
                    nodeName: node.name,
                    message: `${nodeTypeSimple} node without error handling. Consider using "onError" property for better error management.`
                });
            }
        }
        if (node.continueOnFail && node.retryOnFail) {
            result.suggestions.push(`Node "${node.name}": both continueOnFail and retryOnFail are enabled. The node will retry first, then continue on failure.`);
        }
        if (node.executeOnce !== undefined && typeof node.executeOnce !== 'boolean') {
            result.errors.push({
                type: 'error',
                nodeId: node.id,
                nodeName: node.name,
                message: 'executeOnce must be a boolean value'
            });
        }
        if (node.disabled !== undefined && typeof node.disabled !== 'boolean') {
            result.errors.push({
                type: 'error',
                nodeId: node.id,
                nodeName: node.name,
                message: 'disabled must be a boolean value'
            });
        }
        if (node.notesInFlow !== undefined && typeof node.notesInFlow !== 'boolean') {
            result.errors.push({
                type: 'error',
                nodeId: node.id,
                nodeName: node.name,
                message: 'notesInFlow must be a boolean value'
            });
        }
        if (node.notes !== undefined && typeof node.notes !== 'string') {
            result.errors.push({
                type: 'error',
                nodeId: node.id,
                nodeName: node.name,
                message: 'notes must be a string value'
            });
        }
        if (node.executeOnce === true) {
            result.warnings.push({
                type: 'warning',
                nodeId: node.id,
                nodeName: node.name,
                message: 'executeOnce is enabled. This node will execute only once regardless of input items.'
            });
        }
        if ((node.continueOnFail || node.retryOnFail) && !node.alwaysOutputData) {
            if (normalizedType.includes('httprequest') || normalizedType.includes('webhook')) {
                result.suggestions.push(`Consider enabling alwaysOutputData on "${node.name}" to capture error responses for debugging`);
            }
        }
    }
    checkWebhookErrorHandling(node, normalizedType, result) {
        if (normalizedType.includes('respondtowebhook')) {
            return;
        }
        if (node.parameters?.responseMode === 'responseNode') {
            return;
        }
        result.warnings.push({
            type: 'warning',
            nodeId: node.id,
            nodeName: node.name,
            message: 'Webhook node without error handling. Consider adding "onError: \'continueRegularOutput\'" to prevent workflow failures from blocking webhook responses.'
        });
    }
    generateErrorHandlingSuggestions(workflow, result) {
        const nodesWithoutErrorHandling = workflow.nodes.filter(n => !n.disabled && !n.onError && !n.continueOnFail && !n.retryOnFail).length;
        if (nodesWithoutErrorHandling > 5 && workflow.nodes.length > 5) {
            result.suggestions.push('Most nodes lack error handling. Use "onError" property for modern error handling: "continueRegularOutput" (continue on error), "continueErrorOutput" (use error output), or "stopWorkflow" (stop execution).');
        }
        const nodesWithDeprecatedErrorHandling = workflow.nodes.filter(n => !n.disabled && n.continueOnFail === true).length;
        if (nodesWithDeprecatedErrorHandling > 0) {
            result.suggestions.push('Replace "continueOnFail: true" with "onError: \'continueRegularOutput\'" for better UI compatibility and control.');
        }
    }
    validateSplitInBatchesConnection(sourceNode, outputIndex, connection, nodeMap, result) {
        const targetNode = nodeMap.get(connection.node);
        if (!targetNode)
            return;
        if (outputIndex === 0) {
            const targetType = targetNode.type.toLowerCase();
            const targetName = targetNode.name.toLowerCase();
            if (targetType.includes('function') ||
                targetType.includes('code') ||
                targetType.includes('item') ||
                targetName.includes('process') ||
                targetName.includes('transform') ||
                targetName.includes('handle')) {
                const hasLoopBack = this.checkForLoopBack(targetNode.name, sourceNode.name, nodeMap);
                if (hasLoopBack) {
                    result.errors.push({
                        type: 'error',
                        nodeId: sourceNode.id,
                        nodeName: sourceNode.name,
                        message: `SplitInBatches outputs appear reversed! Node "${targetNode.name}" is connected to output 0 ("done") but connects back to the loop. It should be connected to output 1 ("loop") instead. Remember: Output 0 = "done" (post-loop), Output 1 = "loop" (inside loop).`
                    });
                }
                else {
                    result.warnings.push({
                        type: 'warning',
                        nodeId: sourceNode.id,
                        nodeName: sourceNode.name,
                        message: `Node "${targetNode.name}" is connected to the "done" output (index 0) but appears to be a processing node. Consider connecting it to the "loop" output (index 1) if it should process items inside the loop.`
                    });
                }
            }
        }
        else if (outputIndex === 1) {
            const targetType = targetNode.type.toLowerCase();
            const targetName = targetNode.name.toLowerCase();
            if (targetType.includes('aggregate') ||
                targetType.includes('merge') ||
                targetType.includes('email') ||
                targetType.includes('slack') ||
                targetName.includes('final') ||
                targetName.includes('complete') ||
                targetName.includes('summary') ||
                targetName.includes('report')) {
                result.warnings.push({
                    type: 'warning',
                    nodeId: sourceNode.id,
                    nodeName: sourceNode.name,
                    message: `Node "${targetNode.name}" is connected to the "loop" output (index 1) but appears to be a post-processing node. Consider connecting it to the "done" output (index 0) if it should run after all iterations complete.`
                });
            }
            const hasLoopBack = this.checkForLoopBack(targetNode.name, sourceNode.name, nodeMap);
            if (!hasLoopBack) {
                result.warnings.push({
                    type: 'warning',
                    nodeId: sourceNode.id,
                    nodeName: sourceNode.name,
                    message: `The "loop" output connects to "${targetNode.name}" but doesn't connect back to the SplitInBatches node. The last node in the loop should connect back to complete the iteration.`
                });
            }
        }
    }
    checkForLoopBack(startNode, targetNode, nodeMap, visited = new Set(), maxDepth = 50) {
        if (maxDepth <= 0)
            return false;
        if (visited.has(startNode))
            return false;
        visited.add(startNode);
        const node = nodeMap.get(startNode);
        if (!node)
            return false;
        const connections = this.currentWorkflow?.connections[startNode];
        if (!connections)
            return false;
        for (const [outputType, outputs] of Object.entries(connections)) {
            if (!Array.isArray(outputs))
                continue;
            for (const outputConnections of outputs) {
                if (!Array.isArray(outputConnections))
                    continue;
                for (const conn of outputConnections) {
                    if (conn.node === targetNode) {
                        return true;
                    }
                    if (this.checkForLoopBack(conn.node, targetNode, nodeMap, visited, maxDepth - 1)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    addErrorRecoverySuggestions(result) {
        const errorTypes = {
            nodeType: result.errors.filter(e => e.message.includes('node type') || e.message.includes('Node type')),
            connection: result.errors.filter(e => e.message.includes('connection') || e.message.includes('Connection')),
            structure: result.errors.filter(e => e.message.includes('structure') || e.message.includes('nodes must be')),
            configuration: result.errors.filter(e => e.message.includes('property') || e.message.includes('field')),
            typeVersion: result.errors.filter(e => e.message.includes('typeVersion'))
        };
        if (errorTypes.nodeType.length > 0) {
            result.suggestions.unshift('🔧 RECOVERY: Invalid node types detected. Use these patterns:', '   • For core nodes: "n8n-nodes-base.nodeName" (e.g., "n8n-nodes-base.webhook")', '   • For AI nodes: "@n8n/n8n-nodes-langchain.nodeName"', '   • Never use just the node name without package prefix');
        }
        if (errorTypes.connection.length > 0) {
            result.suggestions.unshift('🔧 RECOVERY: Connection errors detected. Fix with:', '   • Use node NAMES in connections, not IDs or types', '   • Structure: { "Source Node Name": { "main": [[{ "node": "Target Node Name", "type": "main", "index": 0 }]] } }', '   • Ensure all referenced nodes exist in the workflow');
        }
        if (errorTypes.structure.length > 0) {
            result.suggestions.unshift('🔧 RECOVERY: Workflow structure errors. Fix with:', '   • Ensure "nodes" is an array: "nodes": [...]', '   • Ensure "connections" is an object: "connections": {...}', '   • Add at least one node to create a valid workflow');
        }
        if (errorTypes.configuration.length > 0) {
            result.suggestions.unshift('🔧 RECOVERY: Node configuration errors. Fix with:', "   • Check required fields using validate_node with mode='minimal' first", '   • Use get_node to see what fields are needed', '   • Ensure operation-specific fields match the node\'s requirements');
        }
        if (errorTypes.typeVersion.length > 0) {
            result.suggestions.unshift('🔧 RECOVERY: TypeVersion errors. Fix with:', '   • Add "typeVersion": 1 (or latest version) to each node', '   • Use get_node to check the correct version for each node type');
        }
        if (result.errors.length > 3) {
            result.suggestions.push('📋 SUGGESTED WORKFLOW: Too many errors detected. Try this approach:', '   1. Fix structural issues first (nodes array, connections object)', '   2. Validate node types and fix invalid ones', '   3. Add required typeVersion to all nodes', '   4. Test connections step by step', "   5. Use validate_node with mode='minimal' on individual nodes to verify configuration");
        }
    }
}
exports.WorkflowValidator = WorkflowValidator;
//# sourceMappingURL=workflow-validator.js.map