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
const node_loader_1 = require("../loaders/node-loader");
const node_parser_1 = require("../parsers/node-parser");
const docs_mapper_1 = require("../mappers/docs-mapper");
const node_repository_1 = require("../database/node-repository");
const core_node_check_1 = require("./core-node-check");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function extractNodeSource(NodeClass, packageName, nodeName) {
    try {
        const possiblePaths = [
            `${packageName}/dist/nodes/${nodeName}.node.js`,
            `${packageName}/dist/nodes/${nodeName}/${nodeName}.node.js`,
            `${packageName}/nodes/${nodeName}.node.js`,
            `${packageName}/nodes/${nodeName}/${nodeName}.node.js`
        ];
        let nodeFilePath = null;
        let nodeSourceCode = '// Source code not found';
        for (const path of possiblePaths) {
            try {
                nodeFilePath = require.resolve(path);
                nodeSourceCode = await fs.promises.readFile(nodeFilePath, 'utf8');
                break;
            }
            catch (e) {
            }
        }
        if (nodeSourceCode === '// Source code not found' && NodeClass.toString) {
            nodeSourceCode = `// Extracted from NodeClass\n${NodeClass.toString()}`;
            nodeFilePath = 'extracted-from-class';
        }
        let credentialSourceCode;
        try {
            const credName = nodeName.replace(/Node$/, '');
            const credentialPaths = [
                `${packageName}/dist/credentials/${credName}.credentials.js`,
                `${packageName}/dist/credentials/${credName}/${credName}.credentials.js`,
                `${packageName}/credentials/${credName}.credentials.js`
            ];
            for (const path of credentialPaths) {
                try {
                    const credFilePath = require.resolve(path);
                    credentialSourceCode = await fs.promises.readFile(credFilePath, 'utf8');
                    break;
                }
                catch (e) {
                }
            }
        }
        catch (error) {
        }
        return {
            nodeSourceCode,
            credentialSourceCode,
            sourceLocation: nodeFilePath || 'unknown'
        };
    }
    catch (error) {
        console.warn(`Could not extract source for ${nodeName}: ${error.message}`);
        return {
            nodeSourceCode: '// Source code extraction failed',
            sourceLocation: 'unknown'
        };
    }
}
async function rebuildOptimized() {
    console.log('🔄 Building optimized n8n node database with embedded source code...\n');
    const dbPath = process.env.BUILD_DB_PATH || './data/nodes.db';
    const db = await (0, database_adapter_1.createDatabaseAdapter)(dbPath);
    const loader = new node_loader_1.N8nNodeLoader();
    const parser = new node_parser_1.NodeParser();
    const mapper = new docs_mapper_1.DocsMapper();
    const repository = new node_repository_1.NodeRepository(db);
    const schemaPath = path.join(__dirname, '../../src/database/schema-optimized.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    db.exec('DELETE FROM nodes');
    console.log('🗑️  Cleared existing data\n');
    const nodes = await loader.loadAllNodes();
    console.log(`📦 Loaded ${nodes.length} nodes from packages\n`);
    const stats = {
        successful: 0,
        failed: 0,
        aiTools: 0,
        triggers: 0,
        webhooks: 0,
        withProperties: 0,
        withOperations: 0,
        withDocs: 0,
        withSource: 0
    };
    for (const { packageName, nodeName, NodeClass } of nodes) {
        try {
            const parsed = parser.parse(NodeClass, packageName);
            if (!parsed.nodeType || !parsed.displayName) {
                throw new Error('Missing required fields');
            }
            const docs = await mapper.fetchDocumentation(parsed.nodeType);
            parsed.documentation = docs || undefined;
            console.log(`📄 Extracting source code for ${parsed.nodeType}...`);
            const sourceInfo = await extractNodeSource(NodeClass, packageName, nodeName);
            const nodeData = {
                ...parsed,
                developmentStyle: parsed.style,
                credentialsRequired: parsed.credentials || [],
                nodeSourceCode: sourceInfo.nodeSourceCode,
                credentialSourceCode: sourceInfo.credentialSourceCode,
                sourceLocation: sourceInfo.sourceLocation,
                sourceExtractedAt: new Date().toISOString()
            };
            const stmt = db.prepare(`
        INSERT INTO nodes (
          node_type, package_name, display_name, description, category,
          development_style, is_ai_tool, is_trigger, is_webhook, is_versioned,
          version, documentation, properties_schema, operations, credentials_required,
          node_source_code, credential_source_code, source_location, source_extracted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            stmt.run(nodeData.nodeType, nodeData.packageName, nodeData.displayName, nodeData.description, nodeData.category, nodeData.developmentStyle, nodeData.isAITool ? 1 : 0, nodeData.isTrigger ? 1 : 0, nodeData.isWebhook ? 1 : 0, nodeData.isVersioned ? 1 : 0, nodeData.version, nodeData.documentation, JSON.stringify(nodeData.properties), JSON.stringify(nodeData.operations), JSON.stringify(nodeData.credentialsRequired), nodeData.nodeSourceCode, nodeData.credentialSourceCode, nodeData.sourceLocation, nodeData.sourceExtractedAt);
            stats.successful++;
            if (parsed.isAITool)
                stats.aiTools++;
            if (parsed.isTrigger)
                stats.triggers++;
            if (parsed.isWebhook)
                stats.webhooks++;
            if (parsed.properties.length > 0)
                stats.withProperties++;
            if (parsed.operations.length > 0)
                stats.withOperations++;
            if (docs)
                stats.withDocs++;
            if (sourceInfo.nodeSourceCode !== '// Source code extraction failed')
                stats.withSource++;
            console.log(`✅ ${parsed.nodeType} [Props: ${parsed.properties.length}, Ops: ${parsed.operations.length}, Source: ${sourceInfo.nodeSourceCode.length} bytes]`);
        }
        catch (error) {
            stats.failed++;
            console.error(`❌ Failed to process ${nodeName}: ${error.message}`);
        }
    }
    console.log('\n🔍 Building full-text search index...');
    db.exec('INSERT INTO nodes_fts(nodes_fts) VALUES("rebuild")');
    console.log('\n🧩 Checking core node completeness...');
    try {
        (0, core_node_check_1.assertCoreNodesPresent)({
            getNode: (nodeType) => db.prepare('SELECT node_type FROM nodes WHERE node_type = ?').get(nodeType)
        });
        console.log('✅ All canonical core nodes present');
    }
    catch (error) {
        console.error(`❌ ${error.message}`);
        db.close();
        process.exit(1);
    }
    console.log('\n📊 Summary:');
    console.log(`   Total nodes: ${nodes.length}`);
    console.log(`   Successful: ${stats.successful}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   AI Tools: ${stats.aiTools}`);
    console.log(`   Triggers: ${stats.triggers}`);
    console.log(`   Webhooks: ${stats.webhooks}`);
    console.log(`   With Properties: ${stats.withProperties}`);
    console.log(`   With Operations: ${stats.withOperations}`);
    console.log(`   With Documentation: ${stats.withDocs}`);
    console.log(`   With Source Code: ${stats.withSource}`);
    const dbStats = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get();
    console.log(`\n💾 Database size: ${(dbStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log('\n✨ Optimized rebuild complete!');
    db.close();
}
if (require.main === module) {
    rebuildOptimized().catch(error => {
        console.error(error);
        process.exit(1);
    });
}
//# sourceMappingURL=rebuild-optimized.js.map