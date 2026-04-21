#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const database_adapter_1 = require("../database/database-adapter");
const zlib = __importStar(require("zlib"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const EXCLUDED_TYPES = new Set([
    'n8n-nodes-base.stickyNote',
    'n8n-nodes-base.noOp',
    'n8n-nodes-base.manualTrigger',
]);
const TASK_NODE_MAPPING = {
    ai_automation: [
        'nodes-langchain.agent', 'nodes-langchain.openAi', 'nodes-langchain.chainLlm',
        'nodes-langchain.lmChatOpenAi', 'nodes-langchain.lmChatAnthropic',
        'nodes-langchain.chainSummarization', 'nodes-langchain.toolWorkflow',
        'nodes-langchain.memoryBufferWindow', 'nodes-langchain.outputParserStructured',
    ],
    webhook_processing: [
        'nodes-base.webhook', 'nodes-base.respondToWebhook',
    ],
    email_automation: [
        'nodes-base.gmail', 'nodes-base.emailSend', 'nodes-base.microsoftOutlook',
        'nodes-base.emailReadImap',
    ],
    slack_integration: [
        'nodes-base.slack', 'nodes-base.slackTrigger',
    ],
    data_sync: [
        'nodes-base.googleSheets', 'nodes-base.airtable', 'nodes-base.postgres',
        'nodes-base.mysql', 'nodes-base.mongoDb',
    ],
    data_transformation: [
        'nodes-base.set', 'nodes-base.code', 'nodes-base.splitInBatches',
        'nodes-base.merge', 'nodes-base.itemLists', 'nodes-base.filter',
        'nodes-base.if', 'nodes-base.switch',
    ],
    scheduling: [
        'nodes-base.scheduleTrigger', 'nodes-base.cron',
    ],
    api_integration: [
        'nodes-base.httpRequest', 'nodes-base.webhook', 'nodes-base.graphql',
    ],
    database_operations: [
        'nodes-base.postgres', 'nodes-base.mongoDb', 'nodes-base.redis',
        'nodes-base.mysql', 'nodes-base.mySql',
    ],
    file_processing: [
        'nodes-base.readBinaryFiles', 'nodes-base.writeBinaryFile',
        'nodes-base.spreadsheetFile', 'nodes-base.googleDrive',
    ],
};
const DISPLAY_NAMES = {
    'n8n-nodes-base.webhook': 'Webhook',
    'n8n-nodes-base.httpRequest': 'HTTP Request',
    'n8n-nodes-base.code': 'Code',
    'n8n-nodes-base.set': 'Set',
    'n8n-nodes-base.if': 'If',
    'n8n-nodes-base.switch': 'Switch',
    'n8n-nodes-base.merge': 'Merge',
    'n8n-nodes-base.filter': 'Filter',
    'n8n-nodes-base.splitInBatches': 'Split In Batches',
    'n8n-nodes-base.itemLists': 'Item Lists',
    'n8n-nodes-base.respondToWebhook': 'Respond to Webhook',
    'n8n-nodes-base.gmail': 'Gmail',
    'n8n-nodes-base.emailSend': 'Send Email',
    'n8n-nodes-base.slack': 'Slack',
    'n8n-nodes-base.slackTrigger': 'Slack Trigger',
    'n8n-nodes-base.googleSheets': 'Google Sheets',
    'n8n-nodes-base.airtable': 'Airtable',
    'n8n-nodes-base.postgres': 'Postgres',
    'n8n-nodes-base.mysql': 'MySQL',
    'n8n-nodes-base.mongoDb': 'MongoDB',
    'n8n-nodes-base.redis': 'Redis',
    'n8n-nodes-base.scheduleTrigger': 'Schedule Trigger',
    'n8n-nodes-base.cron': 'Cron',
    'n8n-nodes-base.googleDrive': 'Google Drive',
    'n8n-nodes-base.spreadsheetFile': 'Spreadsheet File',
    'n8n-nodes-base.readBinaryFiles': 'Read Binary Files',
    'n8n-nodes-base.writeBinaryFile': 'Write Binary File',
    'n8n-nodes-base.graphql': 'GraphQL',
    'n8n-nodes-base.microsoftOutlook': 'Microsoft Outlook',
    'n8n-nodes-base.emailReadImap': 'Email (IMAP)',
    'n8n-nodes-base.noOp': 'No Op',
    '@n8n/n8n-nodes-langchain.agent': 'AI Agent',
    '@n8n/n8n-nodes-langchain.openAi': 'OpenAI',
    '@n8n/n8n-nodes-langchain.chainLlm': 'LLM Chain',
    '@n8n/n8n-nodes-langchain.lmChatOpenAi': 'OpenAI Chat Model',
    '@n8n/n8n-nodes-langchain.lmChatAnthropic': 'Anthropic Chat Model',
    '@n8n/n8n-nodes-langchain.chainSummarization': 'Summarization Chain',
    '@n8n/n8n-nodes-langchain.toolWorkflow': 'Workflow Tool',
    '@n8n/n8n-nodes-langchain.memoryBufferWindow': 'Window Buffer Memory',
    '@n8n/n8n-nodes-langchain.outputParserStructured': 'Structured Output Parser',
    'n8n-nodes-base.manualTrigger': 'Manual Trigger',
};
function matchesCategory(nodeType, categoryPattern) {
    return nodeType.endsWith(categoryPattern) || nodeType.includes(categoryPattern);
}
function getDisplayName(nodeType) {
    if (DISPLAY_NAMES[nodeType]) {
        return DISPLAY_NAMES[nodeType];
    }
    const parts = nodeType.split('.');
    const name = parts[parts.length - 1];
    return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase())
        .trim();
}
function isTriggerType(nodeType) {
    const lower = nodeType.toLowerCase();
    return lower.includes('trigger') || lower.includes('webhook');
}
function classifyTemplate(nodeTypes, metadataCategories) {
    const categories = new Set();
    for (const nodeType of nodeTypes) {
        for (const [category, patterns] of Object.entries(TASK_NODE_MAPPING)) {
            for (const pattern of patterns) {
                if (matchesCategory(nodeType, pattern)) {
                    categories.add(category);
                }
            }
        }
    }
    if (metadataCategories && Array.isArray(metadataCategories)) {
        for (const cat of metadataCategories) {
            const normalized = cat.toLowerCase().replace(/[\s-]+/g, '_');
            for (const key of Object.keys(TASK_NODE_MAPPING)) {
                if (normalized.includes(key) || key.includes(normalized)) {
                    categories.add(key);
                }
            }
        }
    }
    return Array.from(categories);
}
async function main() {
    const dbPath = path.resolve(__dirname, '../../data/nodes.db');
    console.log(`Opening database: ${dbPath}`);
    const db = await (0, database_adapter_1.createDatabaseAdapter)(dbPath);
    console.log('\n=== Pass 1: Node frequency & co-occurrence ===');
    const pass1Start = Date.now();
    const lightRows = db.prepare('SELECT id, nodes_used, metadata_json, views FROM templates ORDER BY views DESC').all();
    const templateCount = lightRows.length;
    console.log(`Found ${templateCount} templates`);
    const nodeFrequency = new Map();
    const pairCooccurrence = new Map();
    const categoryTemplates = new Map();
    const categoryNodes = new Map();
    for (let i = 0; i < lightRows.length; i++) {
        const row = lightRows[i];
        if (i > 0 && i % 500 === 0) {
            console.log(`  Processing template ${i}/${templateCount}...`);
        }
        if (!row.nodes_used)
            continue;
        let nodeTypes;
        try {
            nodeTypes = JSON.parse(row.nodes_used);
            if (!Array.isArray(nodeTypes))
                continue;
        }
        catch {
            continue;
        }
        const uniqueTypes = [...new Set(nodeTypes)].filter(t => !EXCLUDED_TYPES.has(t));
        if (uniqueTypes.length === 0)
            continue;
        for (const nodeType of uniqueTypes) {
            nodeFrequency.set(nodeType, (nodeFrequency.get(nodeType) || 0) + 1);
        }
        for (let a = 0; a < uniqueTypes.length; a++) {
            for (let b = a + 1; b < uniqueTypes.length; b++) {
                const pair = [uniqueTypes[a], uniqueTypes[b]].sort().join('|||');
                pairCooccurrence.set(pair, (pairCooccurrence.get(pair) || 0) + 1);
            }
        }
        let metadataCategories;
        if (row.metadata_json) {
            try {
                const meta = JSON.parse(row.metadata_json);
                metadataCategories = meta.categories;
            }
            catch {
            }
        }
        const categories = classifyTemplate(uniqueTypes, metadataCategories);
        for (const cat of categories) {
            if (!categoryTemplates.has(cat)) {
                categoryTemplates.set(cat, new Set());
                categoryNodes.set(cat, new Map());
            }
            categoryTemplates.get(cat).add(row.id);
            const catNodeMap = categoryNodes.get(cat);
            for (const nodeType of uniqueTypes) {
                catNodeMap.set(nodeType, (catNodeMap.get(nodeType) || 0) + 1);
            }
        }
    }
    const pass1Time = ((Date.now() - pass1Start) / 1000).toFixed(1);
    console.log(`Pass 1 complete: ${pass1Time}s`);
    console.log(`  Unique node types: ${nodeFrequency.size}`);
    console.log(`  Categories found: ${categoryTemplates.size}`);
    console.log('\n=== Pass 2: Connection topology ===');
    const pass2Start = Date.now();
    const compressedRows = db.prepare('SELECT id, nodes_used, workflow_json_compressed, views FROM templates ORDER BY views DESC').all();
    const edgeFrequency = new Map();
    const categoryChains = new Map();
    const globalChains = new Map();
    let decompressedCount = 0;
    let decompressFailCount = 0;
    for (let i = 0; i < compressedRows.length; i++) {
        const row = compressedRows[i];
        if (i > 0 && i % 500 === 0) {
            console.log(`  Processing template ${i}/${templateCount}...`);
        }
        if (!row.workflow_json_compressed)
            continue;
        let workflow;
        try {
            const decompressed = zlib.gunzipSync(Buffer.from(row.workflow_json_compressed, 'base64'));
            workflow = JSON.parse(decompressed.toString());
            decompressedCount++;
        }
        catch {
            decompressFailCount++;
            continue;
        }
        const nodes = workflow.nodes || [];
        const connections = workflow.connections || {};
        const nameToType = new Map();
        for (const node of nodes) {
            if (node.name && node.type && !EXCLUDED_TYPES.has(node.type)) {
                nameToType.set(node.name, node.type);
            }
        }
        const adjacency = new Map();
        for (const sourceName of Object.keys(connections)) {
            const sourceType = nameToType.get(sourceName);
            if (!sourceType)
                continue;
            const mainOutputs = connections[sourceName]?.main;
            if (!Array.isArray(mainOutputs))
                continue;
            for (const outputGroup of mainOutputs) {
                if (!Array.isArray(outputGroup))
                    continue;
                for (const conn of outputGroup) {
                    if (!conn || !conn.node)
                        continue;
                    const targetName = conn.node;
                    const targetType = nameToType.get(targetName);
                    if (!targetType)
                        continue;
                    const edgeKey = `${sourceType}|||${targetType}`;
                    edgeFrequency.set(edgeKey, (edgeFrequency.get(edgeKey) || 0) + 1);
                    if (!adjacency.has(sourceName)) {
                        adjacency.set(sourceName, []);
                    }
                    adjacency.get(sourceName).push(targetName);
                }
            }
        }
        const hasIncoming = new Set();
        for (const targets of adjacency.values()) {
            for (const target of targets) {
                hasIncoming.add(target);
            }
        }
        const triggerNodes = nodes.filter(n => {
            if (EXCLUDED_TYPES.has(n.type))
                return false;
            return !hasIncoming.has(n.name) || isTriggerType(n.type);
        });
        let templateCategories = [];
        try {
            if (row.nodes_used) {
                const parsed = JSON.parse(row.nodes_used);
                if (Array.isArray(parsed)) {
                    templateCategories = classifyTemplate(parsed.filter((t) => !EXCLUDED_TYPES.has(t)));
                }
            }
        }
        catch {
        }
        for (const trigger of triggerNodes) {
            const queue = [
                { nodeName: trigger.name, path: [nameToType.get(trigger.name)] },
            ];
            const visited = new Set([trigger.name]);
            while (queue.length > 0) {
                const { nodeName, path: currentPath } = queue.shift();
                if (currentPath.length >= 2 && currentPath.length <= 4) {
                    const chainKey = currentPath.join('|||');
                    globalChains.set(chainKey, (globalChains.get(chainKey) || 0) + 1);
                    for (const cat of templateCategories) {
                        if (!categoryChains.has(cat)) {
                            categoryChains.set(cat, new Map());
                        }
                        const catChainMap = categoryChains.get(cat);
                        catChainMap.set(chainKey, (catChainMap.get(chainKey) || 0) + 1);
                    }
                }
                if (currentPath.length >= 4)
                    continue;
                const neighbors = adjacency.get(nodeName) || [];
                for (const neighbor of neighbors) {
                    if (visited.has(neighbor))
                        continue;
                    const neighborType = nameToType.get(neighbor);
                    if (!neighborType)
                        continue;
                    visited.add(neighbor);
                    queue.push({ nodeName: neighbor, path: [...currentPath, neighborType] });
                }
            }
        }
    }
    const pass2Time = ((Date.now() - pass2Start) / 1000).toFixed(1);
    console.log(`Pass 2 complete: ${pass2Time}s`);
    console.log(`  Decompressed: ${decompressedCount}, Failed: ${decompressFailCount}`);
    console.log(`  Unique edges: ${edgeFrequency.size}`);
    console.log(`  Unique chains: ${globalChains.size}`);
    console.log('\n=== Building output ===');
    const topNodes = [...nodeFrequency.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 50)
        .map(([type, count]) => ({
        type,
        count,
        frequency: Math.round((count / templateCount) * 100) / 100,
        displayName: getDisplayName(type),
    }));
    const topEdges = [...edgeFrequency.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 50)
        .map(([key, count]) => {
        const [from, to] = key.split('|||');
        return { from, to, count };
    });
    const categories = {};
    for (const [cat, templateIds] of categoryTemplates.entries()) {
        const catNodeMap = categoryNodes.get(cat);
        const catTemplateCount = templateIds.size;
        const catTopNodes = [...catNodeMap.entries()]
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .map(([type, count]) => ({
            type,
            frequency: Math.round((count / catTemplateCount) * 100) / 100,
            role: isTriggerType(type) ? 'trigger' : 'action',
            displayName: getDisplayName(type),
        }));
        const catChainMap = categoryChains.get(cat) || new Map();
        const catTopChains = [...catChainMap.entries()]
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([chainKey, count]) => ({
            chain: chainKey.split('|||'),
            count,
            frequency: Math.round((count / catTemplateCount) * 100) / 100,
        }));
        const triggerNodes = catTopNodes.filter(n => n.role === 'trigger').slice(0, 1);
        const actionNodes = catTopNodes.filter(n => n.role !== 'trigger').slice(0, 3);
        const patternParts = [...triggerNodes, ...actionNodes].map(n => n.displayName);
        const pattern = patternParts.join(' \u2192 ') || 'Mixed workflow';
        categories[cat] = {
            templateCount: catTemplateCount,
            pattern,
            nodes: catTopNodes,
            commonChains: catTopChains,
        };
    }
    const output = {
        generatedAt: new Date().toISOString(),
        templateCount,
        categories,
        global: {
            topNodes,
            topEdges,
        },
    };
    const outputPath = path.resolve(__dirname, '../../data/workflow-patterns.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\nWritten ${Object.keys(categories).length} categories, ${templateCount} templates analyzed`);
    console.log(`Output: ${outputPath}`);
    console.log(`Pass 1: ${pass1Time}s, Pass 2: ${pass2Time}s`);
    console.log(`Total: ${((Date.now() - pass1Start) / 1000).toFixed(1)}s`);
    db.close();
}
main().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
//# sourceMappingURL=mine-workflow-patterns.js.map