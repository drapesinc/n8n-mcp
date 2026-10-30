"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_CONNECTION_TYPES = void 0;
exports.buildReverseConnectionMap = buildReverseConnectionMap;
exports.getAIConnections = getAIConnections;
exports.createAIValidationLookups = createAIValidationLookups;
exports.validateAIAgent = validateAIAgent;
exports.validateChatTrigger = validateChatTrigger;
exports.validateBasicLLMChain = validateBasicLLMChain;
exports.validateAISpecificNodes = validateAISpecificNodes;
exports.hasAINodes = hasAINodes;
exports.getAINodeCategory = getAINodeCategory;
const node_type_normalizer_1 = require("../utils/node-type-normalizer");
const ai_tool_validators_1 = require("./ai-tool-validators");
const MIN_SYSTEM_MESSAGE_LENGTH = 20;
const MAX_ITERATIONS_WARNING_THRESHOLD = 50;
exports.AI_CONNECTION_TYPES = [
    'ai_languageModel',
    'ai_memory',
    'ai_tool',
    'ai_embedding',
    'ai_vectorStore',
    'ai_document',
    'ai_textSplitter',
    'ai_outputParser'
];
function buildReverseConnectionMap(workflow) {
    const map = new Map();
    for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
        if (!sourceName || typeof sourceName !== 'string' || sourceName.trim() === '') {
            continue;
        }
        if (!outputs || typeof outputs !== 'object')
            continue;
        for (const [outputType, connections] of Object.entries(outputs)) {
            if (!Array.isArray(connections))
                continue;
            const connArray = connections.flat().filter(c => c);
            for (const conn of connArray) {
                if (!conn || !conn.node)
                    continue;
                if (typeof conn.node !== 'string' || conn.node.trim() === '') {
                    continue;
                }
                if (!map.has(conn.node)) {
                    map.set(conn.node, []);
                }
                map.get(conn.node).push({
                    sourceName: sourceName,
                    sourceType: outputType,
                    type: outputType,
                    index: conn.index ?? 0
                });
            }
        }
    }
    return map;
}
function getAIConnections(nodeName, reverseConnections, connectionType) {
    const incoming = reverseConnections.get(nodeName) || [];
    if (connectionType) {
        return incoming.filter(c => c.type === connectionType);
    }
    return incoming.filter(c => exports.AI_CONNECTION_TYPES.includes(c.type));
}
function countIncomingByType(incoming) {
    const counts = new Map();
    for (const c of incoming) {
        counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
    }
    return counts;
}
function createAIValidationLookups(workflow, reverseConnections) {
    let nodesByName;
    const incomingCounts = new Map();
    const mainOutputs = new Map();
    const streamingTargets = new Map();
    const lookups = {
        nodeByName(name) {
            if (!nodesByName) {
                nodesByName = new Map();
                for (const n of workflow.nodes) {
                    if (!nodesByName.has(n.name))
                        nodesByName.set(n.name, n);
                }
            }
            return nodesByName.get(name);
        },
        incomingCounts(nodeName) {
            let counts = incomingCounts.get(nodeName);
            if (!counts) {
                counts = countIncomingByType(reverseConnections.get(nodeName) || []);
                incomingCounts.set(nodeName, counts);
            }
            return counts;
        },
        hasMainOutput(nodeName) {
            let has = mainOutputs.get(nodeName);
            if (has === undefined) {
                const main = workflow.connections[nodeName]?.main;
                has = Boolean(main && main.flat().some((c) => c));
                mainOutputs.set(nodeName, has);
            }
            return has;
        },
        isStreamingTarget(node) {
            let streaming = streamingTargets.get(node.name);
            if (streaming === undefined) {
                streaming = checkIfStreamingTarget(node, reverseConnections, lookups);
                streamingTargets.set(node.name, streaming);
            }
            return streaming;
        }
    };
    return lookups;
}
function validateAIAgent(node, reverseConnections, workflow, lookups = createAIValidationLookups(workflow, reverseConnections)) {
    const issues = [];
    const incomingCounts = lookups.incomingCounts(node.name);
    const languageModelCount = incomingCounts.get('ai_languageModel') ?? 0;
    if (languageModelCount === 0) {
        issues.push({
            severity: 'error',
            nodeId: node.id,
            nodeName: node.name,
            message: `AI Agent "${node.name}" requires an ai_languageModel connection. Connect a language model node (e.g., OpenAI Chat Model, Anthropic Chat Model).`,
            code: 'MISSING_LANGUAGE_MODEL'
        });
    }
    else if (languageModelCount > 2) {
        issues.push({
            severity: 'error',
            nodeId: node.id,
            nodeName: node.name,
            message: `AI Agent "${node.name}" has ${languageModelCount} ai_languageModel connections. Maximum is 2 (for fallback model support).`,
            code: 'TOO_MANY_LANGUAGE_MODELS'
        });
    }
    else if (languageModelCount === 2) {
        if (!node.parameters.needsFallback) {
            issues.push({
                severity: 'warning',
                nodeId: node.id,
                nodeName: node.name,
                message: `AI Agent "${node.name}" has 2 language models but needsFallback is not enabled. Set needsFallback=true or remove the second model.`,
                code: 'MULTIPLE_LANGUAGE_MODELS_NO_FALLBACK'
            });
        }
    }
    else if (languageModelCount === 1 && node.parameters.needsFallback === true) {
        issues.push({
            severity: 'error',
            nodeId: node.id,
            nodeName: node.name,
            message: `AI Agent "${node.name}" has needsFallback=true but only 1 language model connected. Connect a second model for fallback or disable needsFallback.`,
            code: 'FALLBACK_MISSING_SECOND_MODEL'
        });
    }
    const outputParserCount = incomingCounts.get('ai_outputParser') ?? 0;
    if (node.parameters.hasOutputParser === true) {
        if (outputParserCount === 0) {
            issues.push({
                severity: 'warning',
                nodeId: node.id,
                nodeName: node.name,
                message: `AI Agent "${node.name}" has hasOutputParser=true but no ai_outputParser connection. The agent will run but return a plain string - connect an output parser or set hasOutputParser=false.`,
                code: 'MISSING_OUTPUT_PARSER'
            });
        }
    }
    else if (outputParserCount > 0) {
        issues.push({
            severity: 'warning',
            nodeId: node.id,
            nodeName: node.name,
            message: `AI Agent "${node.name}" has an output parser connected but hasOutputParser is not true. Set hasOutputParser=true to enable output parsing.`
        });
    }
    if (outputParserCount > 1) {
        issues.push({
            severity: 'error',
            nodeId: node.id,
            nodeName: node.name,
            message: `AI Agent "${node.name}" has ${outputParserCount} output parsers. Only 1 is allowed.`,
            code: 'MULTIPLE_OUTPUT_PARSERS'
        });
    }
    if (node.parameters.promptType === 'define') {
        if (!node.parameters.text || node.parameters.text.trim() === '') {
            issues.push({
                severity: 'error',
                nodeId: node.id,
                nodeName: node.name,
                message: `AI Agent "${node.name}" has promptType="define" but the text field is empty. Provide a custom prompt or switch to promptType="auto".`,
                code: 'MISSING_PROMPT_TEXT'
            });
        }
    }
    const systemMessage = node.parameters.options?.systemMessage ?? node.parameters.systemMessage;
    if (!systemMessage) {
        issues.push({
            severity: 'info',
            nodeId: node.id,
            nodeName: node.name,
            message: `AI Agent "${node.name}" has no systemMessage. Consider adding one to define the agent's role, capabilities, and constraints.`
        });
    }
    else if (typeof systemMessage === 'string' &&
        !systemMessage.startsWith('=') &&
        systemMessage.trim().length < MIN_SYSTEM_MESSAGE_LENGTH) {
        issues.push({
            severity: 'info',
            nodeId: node.id,
            nodeName: node.name,
            message: `AI Agent "${node.name}" systemMessage is very short (minimum ${MIN_SYSTEM_MESSAGE_LENGTH} characters recommended). Provide more detail about the agent's role and capabilities.`
        });
    }
    const isStreamingTarget = lookups.isStreamingTarget(node);
    const hasOwnStreamingEnabled = node.parameters?.options?.streamResponse === true;
    if (isStreamingTarget || hasOwnStreamingEnabled) {
        if (lookups.hasMainOutput(node.name)) {
            const streamSource = isStreamingTarget
                ? 'connected from Chat Trigger with responseMode="streaming"'
                : 'has streamResponse=true in options';
            issues.push({
                severity: 'error',
                nodeId: node.id,
                nodeName: node.name,
                message: `AI Agent "${node.name}" is in streaming mode (${streamSource}) but has outgoing main connections. Remove all main output connections - streaming responses flow back through the Chat Trigger.`,
                code: 'STREAMING_WITH_MAIN_OUTPUT'
            });
        }
    }
    const memoryCount = incomingCounts.get('ai_memory') ?? 0;
    if (memoryCount > 1) {
        issues.push({
            severity: 'error',
            nodeId: node.id,
            nodeName: node.name,
            message: `AI Agent "${node.name}" has ${memoryCount} ai_memory connections. Only 1 memory is allowed.`,
            code: 'MULTIPLE_MEMORY_CONNECTIONS'
        });
    }
    const toolCount = incomingCounts.get('ai_tool') ?? 0;
    if (toolCount === 0) {
        issues.push({
            severity: 'info',
            nodeId: node.id,
            nodeName: node.name,
            message: `AI Agent "${node.name}" has no ai_tool connections. Consider adding tools to enhance the agent's capabilities.`
        });
    }
    if (node.parameters.maxIterations !== undefined) {
        if (typeof node.parameters.maxIterations !== 'number') {
            issues.push({
                severity: 'error',
                nodeId: node.id,
                nodeName: node.name,
                message: `AI Agent "${node.name}" has invalid maxIterations type. Must be a number.`,
                code: 'INVALID_MAX_ITERATIONS_TYPE'
            });
        }
        else if (node.parameters.maxIterations < 1) {
            issues.push({
                severity: 'error',
                nodeId: node.id,
                nodeName: node.name,
                message: `AI Agent "${node.name}" has maxIterations=${node.parameters.maxIterations}. Must be at least 1.`,
                code: 'MAX_ITERATIONS_TOO_LOW'
            });
        }
        else if (node.parameters.maxIterations > MAX_ITERATIONS_WARNING_THRESHOLD) {
            issues.push({
                severity: 'warning',
                nodeId: node.id,
                nodeName: node.name,
                message: `AI Agent "${node.name}" has maxIterations=${node.parameters.maxIterations}. Very high iteration counts (>${MAX_ITERATIONS_WARNING_THRESHOLD}) may cause long execution times and high costs.`
            });
        }
    }
    return issues;
}
function checkIfStreamingTarget(node, reverseConnections, lookups) {
    const incoming = reverseConnections.get(node.name) || [];
    const mainConnections = incoming.filter(c => c.type === 'main');
    for (const conn of mainConnections) {
        const sourceNode = lookups.nodeByName(conn.sourceName);
        if (!sourceNode)
            continue;
        const normalizedType = node_type_normalizer_1.NodeTypeNormalizer.normalizeToFullForm(sourceNode.type);
        if (normalizedType === 'nodes-langchain.chatTrigger') {
            const responseMode = sourceNode.parameters?.options?.responseMode || 'lastNode';
            if (responseMode === 'streaming') {
                return true;
            }
        }
    }
    return false;
}
function validateChatTrigger(node, workflow, reverseConnections, lookups = createAIValidationLookups(workflow, reverseConnections)) {
    const issues = [];
    const responseMode = node.parameters?.options?.responseMode || 'lastNode';
    const outgoingMain = workflow.connections[node.name]?.main;
    if (!outgoingMain || outgoingMain.length === 0 || !outgoingMain[0] || outgoingMain[0].length === 0) {
        issues.push({
            severity: 'error',
            nodeId: node.id,
            nodeName: node.name,
            message: `Chat Trigger "${node.name}" has no outgoing connections. Connect it to an AI Agent or workflow.`,
            code: 'MISSING_CONNECTIONS'
        });
        return issues;
    }
    const firstConnection = outgoingMain[0][0];
    if (!firstConnection) {
        return issues;
    }
    const targetNode = lookups.nodeByName(firstConnection.node);
    if (!targetNode) {
        issues.push({
            severity: 'error',
            nodeId: node.id,
            nodeName: node.name,
            message: `Chat Trigger "${node.name}" connects to non-existent node "${firstConnection.node}".`,
            code: 'INVALID_TARGET_NODE'
        });
        return issues;
    }
    const targetType = node_type_normalizer_1.NodeTypeNormalizer.normalizeToFullForm(targetNode.type);
    if (responseMode === 'streaming') {
        if (targetType !== 'nodes-langchain.agent') {
            issues.push({
                severity: 'error',
                nodeId: node.id,
                nodeName: node.name,
                message: `Chat Trigger "${node.name}" has responseMode="streaming" but connects to "${targetNode.name}" (${targetType}). Streaming mode only works with AI Agent. Change responseMode to "lastNode" or connect to an AI Agent.`,
                code: 'STREAMING_WRONG_TARGET'
            });
        }
        else {
            if (lookups.hasMainOutput(targetNode.name)) {
                issues.push({
                    severity: 'error',
                    nodeId: targetNode.id,
                    nodeName: targetNode.name,
                    message: `AI Agent "${targetNode.name}" is in streaming mode but has outgoing main connections. In streaming mode, the AI Agent must NOT have main output connections - responses stream back through the Chat Trigger.`,
                    code: 'STREAMING_AGENT_HAS_OUTPUT'
                });
            }
        }
    }
    if (responseMode === 'lastNode') {
        if (targetType === 'nodes-langchain.agent') {
            issues.push({
                severity: 'info',
                nodeId: node.id,
                nodeName: node.name,
                message: `Chat Trigger "${node.name}" uses responseMode="lastNode" with AI Agent. Consider using responseMode="streaming" for better user experience with real-time responses.`
            });
        }
    }
    return issues;
}
function validateBasicLLMChain(node, reverseConnections, lookups) {
    const issues = [];
    const incomingCounts = lookups
        ? lookups.incomingCounts(node.name)
        : countIncomingByType(reverseConnections.get(node.name) || []);
    const languageModelCount = incomingCounts.get('ai_languageModel') ?? 0;
    if (languageModelCount === 0) {
        issues.push({
            severity: 'error',
            nodeId: node.id,
            nodeName: node.name,
            message: `Basic LLM Chain "${node.name}" requires an ai_languageModel connection. Connect a language model node.`,
            code: 'MISSING_LANGUAGE_MODEL'
        });
    }
    else if (languageModelCount > 2) {
        issues.push({
            severity: 'error',
            nodeId: node.id,
            nodeName: node.name,
            message: `Basic LLM Chain "${node.name}" has ${languageModelCount} ai_languageModel connections. Maximum is 2 (for fallback model support).`,
            code: 'MULTIPLE_LANGUAGE_MODELS'
        });
    }
    else if (languageModelCount === 2 && !node.parameters.needsFallback) {
        issues.push({
            severity: 'warning',
            nodeId: node.id,
            nodeName: node.name,
            message: `Basic LLM Chain "${node.name}" has 2 language models but needsFallback is not enabled. n8n will only use the first model. Set needsFallback=true or remove the second model.`,
            code: 'MULTIPLE_LANGUAGE_MODELS_NO_FALLBACK'
        });
    }
    const memoryCount = incomingCounts.get('ai_memory') ?? 0;
    if (memoryCount > 1) {
        issues.push({
            severity: 'error',
            nodeId: node.id,
            nodeName: node.name,
            message: `Basic LLM Chain "${node.name}" has ${memoryCount} ai_memory connections. Only 1 memory is allowed.`,
            code: 'MULTIPLE_MEMORY_CONNECTIONS'
        });
    }
    const toolCount = incomingCounts.get('ai_tool') ?? 0;
    if (toolCount > 0) {
        issues.push({
            severity: 'error',
            nodeId: node.id,
            nodeName: node.name,
            message: `Basic LLM Chain "${node.name}" has ai_tool connections. Basic LLM Chain does not support tools. Use AI Agent if you need tool support.`,
            code: 'TOOLS_NOT_SUPPORTED'
        });
    }
    if (node.parameters.promptType === 'define') {
        if (!node.parameters.text || node.parameters.text.trim() === '') {
            issues.push({
                severity: 'error',
                nodeId: node.id,
                nodeName: node.name,
                message: `Basic LLM Chain "${node.name}" has promptType="define" but the text field is empty.`,
                code: 'MISSING_PROMPT_TEXT'
            });
        }
    }
    return issues;
}
function validateAISpecificNodes(workflow) {
    const issues = [];
    const reverseConnectionMap = buildReverseConnectionMap(workflow);
    const lookups = createAIValidationLookups(workflow, reverseConnectionMap);
    for (const node of workflow.nodes) {
        if (node.disabled)
            continue;
        const normalizedType = node_type_normalizer_1.NodeTypeNormalizer.normalizeToFullForm(node.type);
        if (normalizedType === 'nodes-langchain.agent') {
            const nodeIssues = validateAIAgent(node, reverseConnectionMap, workflow, lookups);
            issues.push(...nodeIssues);
        }
        if (normalizedType === 'nodes-langchain.chatTrigger') {
            const nodeIssues = validateChatTrigger(node, workflow, reverseConnectionMap, lookups);
            issues.push(...nodeIssues);
        }
        if (normalizedType === 'nodes-langchain.chainLlm') {
            const nodeIssues = validateBasicLLMChain(node, reverseConnectionMap, lookups);
            issues.push(...nodeIssues);
        }
        if ((0, ai_tool_validators_1.isAIToolSubNode)(normalizedType)) {
            const nodeIssues = (0, ai_tool_validators_1.validateAIToolSubNode)(node, normalizedType, reverseConnectionMap, workflow);
            issues.push(...nodeIssues);
        }
    }
    return issues;
}
function hasAINodes(workflow) {
    const aiNodeTypes = [
        'nodes-langchain.agent',
        'nodes-langchain.chatTrigger',
        'nodes-langchain.chainLlm',
    ];
    return workflow.nodes.some(node => {
        const normalized = node_type_normalizer_1.NodeTypeNormalizer.normalizeToFullForm(node.type);
        return aiNodeTypes.includes(normalized) || (0, ai_tool_validators_1.isAIToolSubNode)(normalized);
    });
}
function getAINodeCategory(nodeType) {
    const normalized = node_type_normalizer_1.NodeTypeNormalizer.normalizeToFullForm(nodeType);
    if (normalized === 'nodes-langchain.agent')
        return 'AI Agent';
    if (normalized === 'nodes-langchain.chatTrigger')
        return 'Chat Trigger';
    if (normalized === 'nodes-langchain.chainLlm')
        return 'Basic LLM Chain';
    if ((0, ai_tool_validators_1.isAIToolSubNode)(normalized))
        return 'AI Tool';
    if (normalized.startsWith('nodes-langchain.')) {
        if (normalized.includes('openAi') || normalized.includes('anthropic') || normalized.includes('googleGemini')) {
            return 'Language Model';
        }
        if (normalized.includes('memory') || normalized.includes('buffer')) {
            return 'Memory';
        }
        if (normalized.includes('vectorStore') || normalized.includes('pinecone') || normalized.includes('qdrant')) {
            return 'Vector Store';
        }
        if (normalized.includes('embedding')) {
            return 'Embeddings';
        }
        return 'AI Component';
    }
    return null;
}
//# sourceMappingURL=ai-node-validator.js.map