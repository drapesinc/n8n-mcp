"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILTER_OPERATOR_TYPES = exports.defaultWorkflowSettings = exports.workflowSettingsSchema = exports.workflowConnectionSchema = exports.WRITABLE_NODE_PROPERTIES = exports.workflowNodeSchema = void 0;
exports.cleanNodeForApi = cleanNodeForApi;
exports.validateWorkflowNode = validateWorkflowNode;
exports.validateWorkflowConnections = validateWorkflowConnections;
exports.validateWorkflowSettings = validateWorkflowSettings;
exports.cleanWorkflowForCreate = cleanWorkflowForCreate;
exports.cleanWorkflowForUpdate = cleanWorkflowForUpdate;
exports.validateWorkflowStructure = validateWorkflowStructure;
exports.hasWebhookTrigger = hasWebhookTrigger;
exports.validateConditionNodeStructure = validateConditionNodeStructure;
exports.validateFilterBasedNodeMetadata = validateFilterBasedNodeMetadata;
exports.describeOperatorValue = describeOperatorValue;
exports.validateOperatorStructure = validateOperatorStructure;
exports.getWebhookUrl = getWebhookUrl;
exports.getWorkflowStructureExample = getWorkflowStructureExample;
exports.getWorkflowFixSuggestions = getWorkflowFixSuggestions;
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const node_type_utils_1 = require("../utils/node-type-utils");
const workflow_settings_1 = require("../constants/workflow-settings");
const node_classification_1 = require("../utils/node-classification");
const mcp_input_normalizer_1 = require("../utils/mcp-input-normalizer");
const workflowNodeObjectSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    type: zod_1.z.string(),
    typeVersion: zod_1.z.number(),
    position: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()]),
    parameters: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    credentials: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    disabled: zod_1.z.boolean().optional(),
    notes: zod_1.z.string().optional(),
    notesInFlow: zod_1.z.boolean().optional(),
    continueOnFail: zod_1.z.boolean().optional(),
    onError: zod_1.z.enum(['continueRegularOutput', 'continueErrorOutput', 'stopWorkflow']).optional(),
    retryOnFail: zod_1.z.boolean().optional(),
    maxTries: zod_1.z.number().optional(),
    waitBetweenTries: zod_1.z.number().optional(),
    alwaysOutputData: zod_1.z.boolean().optional(),
    executeOnce: zod_1.z.boolean().optional(),
    webhookId: zod_1.z.string().optional(),
    customTelemetryTags: zod_1.z
        .object({ tag: zod_1.z.array(zod_1.z.object({ key: zod_1.z.string(), value: zod_1.z.string() })).optional() })
        .optional(),
});
exports.workflowNodeSchema = zod_1.z.preprocess(mcp_input_normalizer_1.normalizeMcpWorkflowNode, workflowNodeObjectSchema);
exports.WRITABLE_NODE_PROPERTIES = new Set(Object.keys(workflowNodeObjectSchema.shape));
function cleanNodeForApi(node) {
    const cleaned = Object.entries(node).filter(([key]) => exports.WRITABLE_NODE_PROPERTIES.has(key));
    return Object.fromEntries(cleaned);
}
const connectionArraySchema = zod_1.z.array(zod_1.z.array(zod_1.z.object({
    node: zod_1.z.string(),
    type: zod_1.z.string(),
    index: zod_1.z.number(),
})).nullable());
exports.workflowConnectionSchema = zod_1.z.preprocess(mcp_input_normalizer_1.normalizeMcpWorkflowConnections, zod_1.z.record(zod_1.z.string(), zod_1.z.object({
    main: connectionArraySchema.optional(),
    error: connectionArraySchema.optional(),
    ai_tool: connectionArraySchema.optional(),
    ai_languageModel: connectionArraySchema.optional(),
    ai_memory: connectionArraySchema.optional(),
    ai_embedding: connectionArraySchema.optional(),
    ai_vectorStore: connectionArraySchema.optional(),
}).catchall(connectionArraySchema)));
exports.workflowSettingsSchema = zod_1.z.object({
    executionOrder: zod_1.z.enum(['v0', 'v1']).default('v1'),
    timezone: zod_1.z.string().optional(),
    saveDataErrorExecution: zod_1.z.enum(['all', 'none']).default('all'),
    saveDataSuccessExecution: zod_1.z.enum(['all', 'none']).default('all'),
    saveManualExecutions: zod_1.z.boolean().default(true),
    saveExecutionProgress: zod_1.z.boolean().default(true),
    executionTimeout: zod_1.z.number().optional(),
    errorWorkflow: zod_1.z.string().optional(),
    callerPolicy: zod_1.z.enum(['any', 'none', 'workflowsFromSameOwner', 'workflowsFromAList']).optional(),
    callerIds: zod_1.z.string().optional(),
    timeSavedMode: zod_1.z.enum(['fixed', 'dynamic']).optional(),
    timeSavedPerExecution: zod_1.z.number().optional(),
    redactionPolicy: zod_1.z.enum(['none', 'non-manual', 'manual-only', 'all']).optional(),
    availableInMCP: zod_1.z.boolean().optional(),
    customTelemetryTags: zod_1.z
        .array(zod_1.z.object({ key: zod_1.z.string(), value: zod_1.z.string() }))
        .optional(),
});
exports.defaultWorkflowSettings = {
    executionOrder: 'v1',
    saveDataErrorExecution: 'all',
    saveDataSuccessExecution: 'all',
    saveManualExecutions: true,
    saveExecutionProgress: true,
};
function validateWorkflowNode(node) {
    return exports.workflowNodeSchema.parse(node);
}
function validateWorkflowConnections(connections) {
    return exports.workflowConnectionSchema.parse(connections);
}
function validateWorkflowSettings(settings) {
    return exports.workflowSettingsSchema.parse(settings);
}
const WEBHOOK_NODE_TYPES = new Set([
    'n8n-nodes-base.webhook',
    'n8n-nodes-base.webhookTrigger',
    'n8n-nodes-base.formTrigger',
    '@n8n/n8n-nodes-langchain.chatTrigger',
]);
function ensureWebhookIds(nodes) {
    if (!nodes)
        return;
    for (const node of nodes) {
        if (WEBHOOK_NODE_TYPES.has(node.type) && !node.webhookId) {
            node.webhookId = crypto_1.default.randomUUID();
        }
    }
}
function stripDerivedSettings(settings) {
    return Object.fromEntries(Object.entries(settings).filter(([key]) => !workflow_settings_1.DERIVED_SETTINGS_PROPERTIES.has(key)));
}
function cleanWorkflowForCreate(workflow) {
    const { id, createdAt, updatedAt, versionId, meta, active, tags, ...cleanedWorkflow } = workflow;
    if (cleanedWorkflow.settings && typeof cleanedWorkflow.settings === 'object') {
        cleanedWorkflow.settings = stripDerivedSettings(cleanedWorkflow.settings);
    }
    if (!cleanedWorkflow.settings || Object.keys(cleanedWorkflow.settings).length === 0) {
        cleanedWorkflow.settings = exports.defaultWorkflowSettings;
    }
    ensureWebhookIds(cleanedWorkflow.nodes);
    if (cleanedWorkflow.nodes) {
        cleanedWorkflow.nodes = cleanedWorkflow.nodes.map(cleanNodeForApi);
    }
    return cleanedWorkflow;
}
function cleanWorkflowForUpdate(workflow) {
    const source = workflow;
    const cleanedWorkflow = {};
    if (source.name !== undefined)
        cleanedWorkflow.name = source.name;
    if (source.nodes !== undefined)
        cleanedWorkflow.nodes = source.nodes;
    if (source.connections !== undefined)
        cleanedWorkflow.connections = source.connections;
    if (Array.isArray(source.nodeGroups))
        cleanedWorkflow.nodeGroups = source.nodeGroups;
    if (source.settings !== undefined)
        cleanedWorkflow.settings = source.settings;
    if (source.parentFolderId !== undefined)
        cleanedWorkflow.parentFolderId = source.parentFolderId;
    if (cleanedWorkflow.settings && typeof cleanedWorkflow.settings === 'object') {
        const filteredSettings = stripDerivedSettings(cleanedWorkflow.settings);
        if (Object.keys(filteredSettings).length > 0) {
            cleanedWorkflow.settings = filteredSettings;
        }
        else {
            cleanedWorkflow.settings = { executionOrder: 'v1' };
        }
    }
    else {
        cleanedWorkflow.settings = { executionOrder: 'v1' };
    }
    ensureWebhookIds(cleanedWorkflow.nodes);
    if (cleanedWorkflow.nodes) {
        cleanedWorkflow.nodes = cleanedWorkflow.nodes.map(cleanNodeForApi);
    }
    return cleanedWorkflow;
}
function describeParseFailure(error) {
    if (!(error instanceof zod_1.z.ZodError)) {
        return error instanceof Error ? error.message : 'Unknown error';
    }
    return error.issues
        .map(issue => (issue.path.length > 0 ? `"${issue.path.join('.')}": ${issue.message}` : issue.message))
        .join('; ');
}
function validateWorkflowStructure(workflow) {
    const errors = [];
    if (!workflow.name) {
        errors.push('Workflow name is required');
    }
    if (!workflow.nodes || workflow.nodes.length === 0) {
        errors.push('Workflow must have at least one node');
    }
    if (workflow.nodes) {
        if (!Array.isArray(workflow.nodes)) {
            errors.push('Workflow nodes must be an array');
            return errors;
        }
        const nodes = [];
        const shapeErrors = [];
        for (const [index, node] of workflow.nodes.entries()) {
            try {
                nodes.push(validateWorkflowNode(node));
            }
            catch (error) {
                shapeErrors.push(`Invalid node at index ${index}: ${describeParseFailure(error)}`);
            }
        }
        if (shapeErrors.length > 0) {
            return [...errors, ...shapeErrors];
        }
        workflow = { ...workflow, nodes };
    }
    if (workflow.nodes && workflow.nodes.length > 0) {
        const hasExecutableNodes = workflow.nodes.some(node => !(0, node_classification_1.isNonExecutableNode)(node.type));
        if (!hasExecutableNodes) {
            errors.push('Workflow must have at least one executable node. Sticky notes alone cannot form a valid workflow.');
        }
    }
    if (!workflow.connections) {
        errors.push('Workflow connections are required');
    }
    else {
        try {
            workflow = { ...workflow, connections: validateWorkflowConnections(workflow.connections) };
        }
        catch (error) {
            return [...errors, `Invalid connections: ${describeParseFailure(error)}`];
        }
    }
    if (workflow.nodes && workflow.nodes.length === 1) {
        const singleNode = workflow.nodes[0];
        const isWebhookOnly = singleNode.type === 'n8n-nodes-base.webhook' ||
            singleNode.type === 'n8n-nodes-base.webhookTrigger';
        if (!isWebhookOnly) {
            errors.push(`Single non-webhook node workflow is invalid. Current node: "${singleNode.name}" (${singleNode.type}). Add another node using: {type: 'addNode', node: {name: 'Process Data', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [450, 300], parameters: {}}}`);
        }
    }
    if (workflow.nodes && workflow.nodes.length > 1 && workflow.connections) {
        const executableNodes = workflow.nodes.filter(node => !(0, node_classification_1.isNonExecutableNode)(node.type));
        const connectionCount = Object.keys(workflow.connections).length;
        if (connectionCount === 0 && executableNodes.length > 1) {
            const nodeNames = executableNodes.slice(0, 2).map(n => n.name);
            errors.push(`Multi-node workflow has no connections between nodes. Add a connection using: {type: 'addConnection', source: '${nodeNames[0]}', target: '${nodeNames[1]}', sourcePort: 'main', targetPort: 'main'}`);
        }
        else if (connectionCount > 0 || executableNodes.length > 1) {
            const connectedNodes = new Set();
            Object.entries(workflow.connections).forEach(([sourceName, connection]) => {
                let hasTarget = false;
                const connectionRecord = connection;
                Object.values(connectionRecord).forEach((connData) => {
                    if (connData && Array.isArray(connData)) {
                        connData.forEach((outputs) => {
                            if (Array.isArray(outputs)) {
                                outputs.forEach((target) => {
                                    if (target?.node) {
                                        connectedNodes.add(target.node);
                                        hasTarget = true;
                                    }
                                });
                            }
                        });
                    }
                });
                if (hasTarget)
                    connectedNodes.add(sourceName);
            });
            const disconnectedNodes = workflow.nodes.filter(node => {
                if ((0, node_classification_1.isNonExecutableNode)(node.type)) {
                    return false;
                }
                return !connectedNodes.has(node.name);
            });
            if (disconnectedNodes.length > 0) {
                const disconnectedList = disconnectedNodes.map(n => `"${n.name}" (${n.type})`).join(', ');
                const firstDisconnected = disconnectedNodes[0];
                const suggestedSource = workflow.nodes.find(n => connectedNodes.has(n.name) && !(0, node_classification_1.isNonExecutableNode)(n.type))?.name
                    || workflow.nodes.find(n => n.name !== firstDisconnected.name && !(0, node_classification_1.isNonExecutableNode)(n.type))?.name;
                const hint = suggestedSource
                    ? ` Add a connection: {type: 'addConnection', source: '${suggestedSource}', target: '${firstDisconnected.name}', sourcePort: 'main', targetPort: 'main'}`
                    : '';
                errors.push(`Disconnected nodes detected: ${disconnectedList}. Each node must have at least one connection.${hint}`);
            }
        }
    }
    if (workflow.nodes) {
        workflow.nodes.forEach((node, index) => {
            if (node.type.startsWith('nodes-base.')) {
                errors.push(`Invalid node type "${node.type}" at index ${index}. Use "n8n-nodes-base.${node.type.substring(11)}" instead.`);
            }
            else if (!node.type.includes('.')) {
                errors.push(`Invalid node type "${node.type}" at index ${index}. Node types must include package prefix (e.g., "n8n-nodes-base.webhook").`);
            }
        });
    }
    if (workflow.nodes) {
        workflow.nodes.forEach((node, index) => {
            const filterErrors = validateConditionNodeStructure(node);
            if (filterErrors.length > 0) {
                errors.push(...filterErrors.map(err => `Node "${node.name}" (index ${index}): ${err}`));
            }
        });
    }
    if (workflow.active === true && workflow.nodes && workflow.nodes.length > 0) {
        const activatableTriggers = workflow.nodes.filter(node => !node.disabled && (0, node_type_utils_1.isActivatableTrigger)(node.type));
        if (activatableTriggers.length === 0) {
            errors.push('Cannot activate workflow: No activatable trigger nodes found. ' +
                'Workflows must have at least one enabled trigger node (webhook, schedule, executeWorkflowTrigger, etc.).');
        }
    }
    if (workflow.nodes && workflow.connections) {
        const switchNodes = workflow.nodes.filter(node => isRulesModeSwitch(node) && (node.typeVersion || 1) >= 2);
        const ruleLabel = (rule, i) => typeof rule?.outputKey === 'string' ? `"${rule.outputKey}" (index ${i})` : `Rule ${i}`;
        for (const switchNode of switchNodes) {
            const params = switchNode.parameters;
            const ruleCollection = params?.rules?.values ?? params?.rules?.rules;
            const rules = Array.isArray(ruleCollection) ? ruleCollection : [];
            const nodeConnections = workflow.connections[switchNode.name];
            if (Array.isArray(ruleCollection) && nodeConnections?.main) {
                const outputBranches = nodeConnections.main.length;
                const fallbackOutput = params?.options?.fallbackOutput ?? params?.fallbackOutput;
                const fallbackOutputs = fallbackOutput === 'extra' ? 1 : 0;
                const errorOutputs = switchNode.onError === 'continueErrorOutput' ? 1 : 0;
                const outputCount = rules.length + fallbackOutputs + errorOutputs;
                if (outputBranches > outputCount) {
                    const ruleNames = rules.map(ruleLabel).join(', ');
                    errors.push(`Switch node "${switchNode.name}" has ${rules.length} rules [${ruleNames}]` +
                        (fallbackOutputs ? ' plus a fallback output' : '') +
                        (errorOutputs ? ' plus an error output' : '') +
                        ` but ${outputBranches} output branches in connections. ` +
                        (outputCount > 0
                            ? `Outputs are indexed 0 to ${outputCount - 1}; remove the extra branches or add rules for them.`
                            : 'The Switch has no outputs; add rules or a fallback output before connecting branches.'));
                }
            }
        }
    }
    if (workflow.nodes && workflow.connections) {
        const nodeNames = new Set(workflow.nodes.map(node => node.name));
        const nodeIds = new Set(workflow.nodes.map(node => node.id));
        const nodeIdToName = new Map(workflow.nodes.map(node => [node.id, node.name]));
        Object.entries(workflow.connections).forEach(([sourceName, connection]) => {
            if (!nodeNames.has(sourceName)) {
                if (nodeIds.has(sourceName)) {
                    const correctName = nodeIdToName.get(sourceName);
                    errors.push(`Connection uses node ID '${sourceName}' but must use node name '${correctName}'. Change connections.${sourceName} to connections['${correctName}']`);
                }
                else {
                    errors.push(`Connection references non-existent node: ${sourceName}`);
                }
            }
            const connectionRecord = connection;
            Object.values(connectionRecord).forEach((connData) => {
                if (connData && Array.isArray(connData)) {
                    connData.forEach((outputs, outputIndex) => {
                        if (Array.isArray(outputs)) {
                            outputs.forEach((target, targetIndex) => {
                                if (!target?.node)
                                    return;
                                if (!nodeNames.has(target.node)) {
                                    if (nodeIds.has(target.node)) {
                                        const correctName = nodeIdToName.get(target.node);
                                        errors.push(`Connection target uses node ID '${target.node}' but must use node name '${correctName}' (from ${sourceName}[${outputIndex}][${targetIndex}])`);
                                    }
                                    else {
                                        errors.push(`Connection references non-existent target node: ${target.node} (from ${sourceName}[${outputIndex}][${targetIndex}])`);
                                    }
                                }
                            });
                        }
                    });
                }
            });
        });
    }
    return errors;
}
function hasWebhookTrigger(workflow) {
    return workflow.nodes.some(node => node.type === 'n8n-nodes-base.webhook' ||
        node.type === 'n8n-nodes-base.webhookTrigger');
}
function validateConditionNodeStructure(node) {
    const errors = [];
    const typeVersion = node.typeVersion || 1;
    if (node.type === 'n8n-nodes-base.if' || node.type === 'n8n-nodes-base.filter') {
        if (typeVersion >= 2) {
            errors.push(...validateFilterConditionOperators(node.parameters?.conditions, 'conditions'));
        }
    }
    else if (isRulesModeSwitch(node) && typeVersion >= 3.2) {
        const rules = node.parameters?.rules;
        errors.push(...validateSwitchRuleCollection(rules?.values, 'rules.values'));
        errors.push(...validateSwitchRuleCollection(rules?.rules, 'rules.rules'));
    }
    return errors;
}
function isRulesModeSwitch(node) {
    if (node.type !== 'n8n-nodes-base.switch')
        return false;
    const mode = node.parameters?.mode;
    return !mode || mode === 'rules';
}
function validateSwitchRuleCollection(collection, path) {
    if (collection === undefined || collection === null)
        return [];
    if (!Array.isArray(collection))
        return [`${path}: rules is not an array`];
    const errors = [];
    collection.forEach((rule, i) => {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
            errors.push(`${path}[${i}]: rule is missing or not an object`);
            return;
        }
        errors.push(...validateFilterConditionOperators(rule.conditions, `${path}[${i}].conditions`));
    });
    return errors;
}
function validateFilterConditionOperators(conditions, path) {
    const errors = [];
    if (!conditions?.conditions || !Array.isArray(conditions.conditions))
        return errors;
    conditions.conditions.forEach((condition, i) => {
        errors.push(...validateOperatorStructure(condition?.operator, `${path}.conditions[${i}].operator`));
    });
    return errors;
}
function validateFilterBasedNodeMetadata(node) {
    return validateConditionNodeStructure(node);
}
exports.FILTER_OPERATOR_TYPES = ['string', 'number', 'boolean', 'dateTime', 'array', 'object', 'any'];
function describeOperatorValue(value) {
    if (value === null)
        return 'null';
    if (value === undefined)
        return 'nothing';
    if (Array.isArray(value))
        return 'an array';
    if (typeof value === 'object')
        return 'an object';
    return typeof value === 'string' ? `"${value}"` : `a ${typeof value} (${String(value)})`;
}
function validateOperatorStructure(operator, path) {
    const errors = [];
    if (!operator || typeof operator !== 'object') {
        errors.push(`${path}: operator is missing or not an object`);
        return errors;
    }
    if (!operator.type) {
        errors.push(`${path}: missing required field "type". ` +
            `Must be a data type: ${exports.FILTER_OPERATOR_TYPES.map(t => `"${t}"`).join(', ')}`);
    }
    else if (!exports.FILTER_OPERATOR_TYPES.includes(operator.type)) {
        errors.push(`${path}: invalid type ${describeOperatorValue(operator.type)}. ` +
            `Type must be a data type (${exports.FILTER_OPERATOR_TYPES.join(', ')}), not an operation name. ` +
            'Did you mean to use the "operation" field?');
    }
    if (!operator.operation) {
        errors.push(`${path}: missing required field "operation". ` +
            'Operation specifies the comparison type (e.g., "equals", "contains", "notEmpty")');
    }
    return errors;
}
function getWebhookUrl(workflow) {
    const webhookNode = workflow.nodes.find(node => node.type === 'n8n-nodes-base.webhook' ||
        node.type === 'n8n-nodes-base.webhookTrigger');
    if (!webhookNode || !webhookNode.parameters) {
        return null;
    }
    const path = webhookNode.parameters.path;
    if (!path) {
        return null;
    }
    return path;
}
function getWorkflowStructureExample() {
    return `
Minimal Workflow Example:
{
  "name": "My Workflow",
  "nodes": [
    {
      "id": "manual-trigger-1",
      "name": "Manual Trigger",
      "type": "n8n-nodes-base.manualTrigger",
      "typeVersion": 1,
      "position": [250, 300],
      "parameters": {}
    },
    {
      "id": "set-1",
      "name": "Set Data",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [450, 300],
      "parameters": {
        "mode": "manual",
        "assignments": {
          "assignments": [{
            "id": "1",
            "name": "message",
            "value": "Hello World",
            "type": "string"
          }]
        }
      }
    }
  ],
  "connections": {
    "Manual Trigger": {
      "main": [[{
        "node": "Set Data",
        "type": "main",
        "index": 0
      }]]
    }
  }
}

IMPORTANT: In connections, use the node NAME (e.g., "Manual Trigger"), NOT the node ID or type!`;
}
function getWorkflowFixSuggestions(errors) {
    const suggestions = [];
    if (errors.some(e => e.includes('empty connections'))) {
        suggestions.push('Add connections between your nodes. Each node (except endpoints) should connect to another node.');
        suggestions.push('Connection format: connections: { "Source Node Name": { "main": [[{ "node": "Target Node Name", "type": "main", "index": 0 }]] } }');
    }
    if (errors.some(e => e.includes('Single-node workflows'))) {
        suggestions.push('Add at least one more node to process data. Common patterns: Trigger → Process → Output');
        suggestions.push('Examples: Manual Trigger → Set, Webhook → HTTP Request, Schedule Trigger → Database Query');
    }
    if (errors.some(e => e.includes('node ID') && e.includes('instead of node name'))) {
        suggestions.push('Replace node IDs with node names in connections. The name is what appears in the node header.');
        suggestions.push('Wrong: connections: { "set-1": {...} }, Right: connections: { "Set Data": {...} }');
    }
    return suggestions;
}
//# sourceMappingURL=n8n-validation.js.map