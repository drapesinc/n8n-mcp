"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeDocumentationService = void 0;
const crypto_1 = require("crypto");
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
const node_source_extractor_1 = require("../utils/node-source-extractor");
const enhanced_documentation_fetcher_1 = require("../utils/enhanced-documentation-fetcher");
const example_generator_1 = require("../utils/example-generator");
const database_adapter_1 = require("../database/database-adapter");
const compressed_column_1 = require("../database/compressed-column");
class NodeDocumentationService {
    constructor(dbPath) {
        this.db = null;
        this.dbPath = dbPath || process.env.NODE_DB_PATH || this.findDatabasePath();
        const dbDir = path_1.default.dirname(this.dbPath);
        if (!require('fs').existsSync(dbDir)) {
            require('fs').mkdirSync(dbDir, { recursive: true });
        }
        this.extractor = new node_source_extractor_1.NodeSourceExtractor();
        this.docsFetcher = new enhanced_documentation_fetcher_1.EnhancedDocumentationFetcher();
        this.initialized = this.initializeAsync();
    }
    findDatabasePath() {
        const fs = require('fs');
        const localPath = path_1.default.join(process.cwd(), 'data', 'nodes.db');
        if (fs.existsSync(localPath)) {
            return localPath;
        }
        const packagePath = path_1.default.join(__dirname, '..', '..', 'data', 'nodes.db');
        if (fs.existsSync(packagePath)) {
            return packagePath;
        }
        const globalPath = path_1.default.join(__dirname, '..', '..', '..', 'data', 'nodes.db');
        if (fs.existsSync(globalPath)) {
            return globalPath;
        }
        return localPath;
    }
    async initializeAsync() {
        try {
            this.db = await (0, database_adapter_1.createDatabaseAdapter)(this.dbPath);
            this.initializeDatabase();
            logger_1.logger.info('Node Documentation Service initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize database adapter', error);
            throw error;
        }
    }
    async ensureInitialized() {
        await this.initialized;
        if (!this.db) {
            throw new Error('Database not initialized');
        }
    }
    initializeDatabase() {
        if (!this.db)
            throw new Error('Database not initialized');
        const schema = `
-- Main nodes table with documentation and examples
CREATE TABLE IF NOT EXISTS nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_type TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  icon TEXT,
  
  -- Source code
  source_code TEXT NOT NULL,
  credential_code TEXT,
  code_hash TEXT NOT NULL,
  code_length INTEGER NOT NULL,
  
  -- Documentation
  documentation_markdown TEXT,
  documentation_url TEXT,
  documentation_title TEXT,
  
  -- Enhanced documentation fields (stored as JSON)
  operations TEXT,
  api_methods TEXT,
  documentation_examples TEXT,
  templates TEXT,
  related_resources TEXT,
  required_scopes TEXT,
  
  -- Example usage
  example_workflow TEXT,
  example_parameters TEXT,
  properties_schema TEXT,
  
  -- Metadata
  package_name TEXT NOT NULL,
  version TEXT,
  codex_data TEXT,
  aliases TEXT,
  
  -- Flags
  has_credentials INTEGER DEFAULT 0,
  is_trigger INTEGER DEFAULT 0,
  is_webhook INTEGER DEFAULT 0,
  
  -- Timestamps
  extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nodes_package_name ON nodes(package_name);
CREATE INDEX IF NOT EXISTS idx_nodes_category ON nodes(category);
CREATE INDEX IF NOT EXISTS idx_nodes_code_hash ON nodes(code_hash);
CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(name);
CREATE INDEX IF NOT EXISTS idx_nodes_is_trigger ON nodes(is_trigger);

-- Full Text Search
CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
  node_type,
  name,
  display_name,
  description,
  category,
  documentation_markdown,
  aliases,
  content=nodes,
  content_rowid=id
);

-- Triggers for FTS
CREATE TRIGGER IF NOT EXISTS nodes_ai AFTER INSERT ON nodes
BEGIN
  INSERT INTO nodes_fts(rowid, node_type, name, display_name, description, category, documentation_markdown, aliases)
  VALUES (new.id, new.node_type, new.name, new.display_name, new.description, new.category, new.documentation_markdown, new.aliases);
END;

CREATE TRIGGER IF NOT EXISTS nodes_ad AFTER DELETE ON nodes
BEGIN
  DELETE FROM nodes_fts WHERE rowid = old.id;
END;

CREATE TRIGGER IF NOT EXISTS nodes_au AFTER UPDATE ON nodes
BEGIN
  DELETE FROM nodes_fts WHERE rowid = old.id;
  INSERT INTO nodes_fts(rowid, node_type, name, display_name, description, category, documentation_markdown, aliases)
  VALUES (new.id, new.node_type, new.name, new.display_name, new.description, new.category, new.documentation_markdown, new.aliases);
END;

-- Documentation sources table
CREATE TABLE IF NOT EXISTS documentation_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  commit_hash TEXT,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Statistics table
CREATE TABLE IF NOT EXISTS extraction_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total_nodes INTEGER NOT NULL,
  nodes_with_docs INTEGER NOT NULL,
  nodes_with_examples INTEGER NOT NULL,
  total_code_size INTEGER NOT NULL,
  total_docs_size INTEGER NOT NULL,
  extraction_date DATETIME DEFAULT CURRENT_TIMESTAMP
);
    `;
        this.db.exec(schema);
    }
    async storeNode(nodeInfo) {
        await this.ensureInitialized();
        const hash = this.generateHash(nodeInfo.sourceCode);
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO nodes (
        node_type, name, display_name, description, category, subcategory, icon,
        source_code, credential_code, code_hash, code_length,
        documentation_markdown, documentation_url, documentation_title,
        operations, api_methods, documentation_examples, templates, related_resources, required_scopes,
        example_workflow, example_parameters, properties_schema,
        package_name, version, codex_data, aliases,
        has_credentials, is_trigger, is_webhook
      ) VALUES (
        @nodeType, @name, @displayName, @description, @category, @subcategory, @icon,
        @sourceCode, @credentialCode, @hash, @codeLength,
        @documentation, @documentationUrl, @documentationTitle,
        @operations, @apiMethods, @documentationExamples, @templates, @relatedResources, @requiredScopes,
        @exampleWorkflow, @exampleParameters, @propertiesSchema,
        @packageName, @version, @codexData, @aliases,
        @hasCredentials, @isTrigger, @isWebhook
      )
    `);
        stmt.run({
            nodeType: nodeInfo.nodeType,
            name: nodeInfo.name,
            displayName: nodeInfo.displayName || nodeInfo.name,
            description: nodeInfo.description || '',
            category: nodeInfo.category || 'Other',
            subcategory: nodeInfo.subcategory || null,
            icon: nodeInfo.icon || null,
            sourceCode: nodeInfo.sourceCode,
            credentialCode: nodeInfo.credentialCode || null,
            hash,
            codeLength: nodeInfo.sourceCode.length,
            documentation: nodeInfo.documentationMarkdown || null,
            documentationUrl: nodeInfo.documentationUrl || null,
            documentationTitle: nodeInfo.documentationTitle || null,
            operations: nodeInfo.operations ? JSON.stringify(nodeInfo.operations) : null,
            apiMethods: nodeInfo.apiMethods ? JSON.stringify(nodeInfo.apiMethods) : null,
            documentationExamples: nodeInfo.documentationExamples ? JSON.stringify(nodeInfo.documentationExamples) : null,
            templates: nodeInfo.templates ? JSON.stringify(nodeInfo.templates) : null,
            relatedResources: nodeInfo.relatedResources ? JSON.stringify(nodeInfo.relatedResources) : null,
            requiredScopes: nodeInfo.requiredScopes ? JSON.stringify(nodeInfo.requiredScopes) : null,
            exampleWorkflow: nodeInfo.exampleWorkflow ? JSON.stringify(nodeInfo.exampleWorkflow) : null,
            exampleParameters: nodeInfo.exampleParameters ? JSON.stringify(nodeInfo.exampleParameters) : null,
            propertiesSchema: nodeInfo.propertiesSchema ? JSON.stringify(nodeInfo.propertiesSchema) : null,
            packageName: nodeInfo.packageName,
            version: nodeInfo.version || null,
            codexData: nodeInfo.codexData ? JSON.stringify(nodeInfo.codexData) : null,
            aliases: nodeInfo.aliases ? JSON.stringify(nodeInfo.aliases) : null,
            hasCredentials: nodeInfo.hasCredentials ? 1 : 0,
            isTrigger: nodeInfo.isTrigger ? 1 : 0,
            isWebhook: nodeInfo.isWebhook ? 1 : 0
        });
    }
    async getNodeInfo(nodeType) {
        await this.ensureInitialized();
        const stmt = this.db.prepare(`
      SELECT * FROM nodes WHERE node_type = ? OR name = ? COLLATE NOCASE
    `);
        const row = stmt.get(nodeType, nodeType);
        if (!row)
            return null;
        return this.rowToNodeInfo(row);
    }
    async searchNodes(options) {
        await this.ensureInitialized();
        let query = 'SELECT * FROM nodes WHERE 1=1';
        const params = {};
        if (options.query) {
            query += ` AND id IN (
        SELECT rowid FROM nodes_fts 
        WHERE nodes_fts MATCH @query
      )`;
            params.query = options.query;
        }
        if (options.nodeType) {
            query += ' AND node_type LIKE @nodeType';
            params.nodeType = `%${options.nodeType}%`;
        }
        if (options.packageName) {
            query += ' AND package_name = @packageName';
            params.packageName = options.packageName;
        }
        if (options.category) {
            query += ' AND category = @category';
            params.category = options.category;
        }
        if (options.hasCredentials !== undefined) {
            query += ' AND has_credentials = @hasCredentials';
            params.hasCredentials = options.hasCredentials ? 1 : 0;
        }
        if (options.isTrigger !== undefined) {
            query += ' AND is_trigger = @isTrigger';
            params.isTrigger = options.isTrigger ? 1 : 0;
        }
        query += ' ORDER BY name LIMIT @limit';
        params.limit = options.limit || 20;
        const stmt = this.db.prepare(query);
        const rows = stmt.all(params);
        return rows.map(row => this.rowToNodeInfo(row));
    }
    async listNodes() {
        await this.ensureInitialized();
        const stmt = this.db.prepare('SELECT * FROM nodes ORDER BY name');
        const rows = stmt.all();
        return rows.map(row => this.rowToNodeInfo(row));
    }
    async rebuildDatabase() {
        await this.ensureInitialized();
        logger_1.logger.info('Starting complete database rebuild...');
        this.db.exec('DELETE FROM nodes');
        this.db.exec('DELETE FROM extraction_stats');
        await this.docsFetcher.ensureDocsRepository();
        const stats = {
            total: 0,
            successful: 0,
            failed: 0,
            errors: []
        };
        try {
            const availableNodes = await this.extractor.listAvailableNodes();
            stats.total = availableNodes.length;
            logger_1.logger.info(`Found ${stats.total} nodes to process`);
            const batchSize = 10;
            for (let i = 0; i < availableNodes.length; i += batchSize) {
                const batch = availableNodes.slice(i, i + batchSize);
                await Promise.all(batch.map(async (node) => {
                    try {
                        const nodeType = `n8n-nodes-base.${node.name}`;
                        const nodeData = await this.extractor.extractNodeSource(nodeType);
                        if (!nodeData || !nodeData.sourceCode) {
                            throw new Error('Failed to extract node source');
                        }
                        const nodeDefinition = this.parseNodeDefinition(nodeData.sourceCode);
                        const enhancedDocs = await this.docsFetcher.getEnhancedNodeDocumentation(nodeType);
                        const example = example_generator_1.ExampleGenerator.generateFromNodeDefinition(nodeDefinition);
                        const nodeInfo = {
                            nodeType: nodeType,
                            name: node.name,
                            displayName: nodeDefinition.displayName || node.displayName || node.name,
                            description: nodeDefinition.description || node.description || '',
                            category: nodeDefinition.category || 'Other',
                            subcategory: nodeDefinition.subcategory,
                            icon: nodeDefinition.icon,
                            sourceCode: nodeData.sourceCode,
                            credentialCode: nodeData.credentialCode,
                            documentationMarkdown: enhancedDocs?.markdown,
                            documentationUrl: enhancedDocs?.url,
                            documentationTitle: enhancedDocs?.title,
                            operations: enhancedDocs?.operations,
                            apiMethods: enhancedDocs?.apiMethods,
                            documentationExamples: enhancedDocs?.examples,
                            templates: enhancedDocs?.templates,
                            relatedResources: enhancedDocs?.relatedResources,
                            requiredScopes: enhancedDocs?.requiredScopes,
                            exampleWorkflow: example,
                            exampleParameters: example.nodes[0]?.parameters,
                            propertiesSchema: nodeDefinition.properties,
                            packageName: nodeData.packageInfo?.name || 'n8n-nodes-base',
                            version: nodeDefinition.version,
                            codexData: nodeDefinition.codex,
                            aliases: nodeDefinition.alias,
                            hasCredentials: !!nodeData.credentialCode,
                            isTrigger: node.name.toLowerCase().includes('trigger'),
                            isWebhook: node.name.toLowerCase().includes('webhook')
                        };
                        await this.storeNode(nodeInfo);
                        stats.successful++;
                        logger_1.logger.debug(`Processed node: ${nodeType}`);
                    }
                    catch (error) {
                        stats.failed++;
                        const errorMsg = `Failed to process ${node.name}: ${error instanceof Error ? error.message : String(error)}`;
                        stats.errors.push(errorMsg);
                        logger_1.logger.error(errorMsg);
                    }
                }));
                logger_1.logger.info(`Progress: ${Math.min(i + batchSize, availableNodes.length)}/${stats.total} nodes processed`);
            }
            this.storeStatistics(stats);
            logger_1.logger.info(`Database rebuild complete: ${stats.successful} successful, ${stats.failed} failed`);
        }
        catch (error) {
            logger_1.logger.error('Database rebuild failed:', error);
            throw error;
        }
        return stats;
    }
    parseNodeDefinition(sourceCode) {
        const result = {
            displayName: '',
            description: '',
            properties: [],
            category: null,
            subcategory: null,
            icon: null,
            version: null,
            codex: null,
            alias: null
        };
        try {
            const displayNameMatch = sourceCode.match(/displayName\s*[:=]\s*['"`]([^'"`]+)['"`]/);
            if (displayNameMatch) {
                result.displayName = displayNameMatch[1];
            }
            const descriptionMatch = sourceCode.match(/description\s*[:=]\s*['"`]([^'"`]+)['"`]/);
            if (descriptionMatch) {
                result.description = descriptionMatch[1];
            }
            const iconMatch = sourceCode.match(/icon\s*[:=]\s*['"`]([^'"`]+)['"`]/);
            if (iconMatch) {
                result.icon = iconMatch[1];
            }
            const groupMatch = sourceCode.match(/group\s*[:=]\s*\[['"`]([^'"`]+)['"`]\]/);
            if (groupMatch) {
                result.category = groupMatch[1];
            }
            const versionMatch = sourceCode.match(/version\s*[:=]\s*(\d+)/);
            if (versionMatch) {
                result.version = parseInt(versionMatch[1]);
            }
            const subtitleMatch = sourceCode.match(/subtitle\s*[:=]\s*['"`]([^'"`]+)['"`]/);
            if (subtitleMatch) {
                result.subtitle = subtitleMatch[1];
            }
            const propsMatch = sourceCode.match(/properties\s*[:=]\s*(\[[\s\S]*?\])\s*[,}]/);
            if (propsMatch) {
                try {
                    result.properties = [];
                }
                catch (e) {
                }
            }
            if (sourceCode.includes('implements.*ITrigger') ||
                sourceCode.includes('polling:.*true') ||
                sourceCode.includes('webhook:.*true') ||
                result.displayName.toLowerCase().includes('trigger')) {
                result.isTrigger = true;
            }
            if (sourceCode.includes('webhooks:') ||
                sourceCode.includes('webhook:.*true') ||
                result.displayName.toLowerCase().includes('webhook')) {
                result.isWebhook = true;
            }
        }
        catch (error) {
            logger_1.logger.debug('Error parsing node definition:', error);
        }
        return result;
    }
    rowToNodeInfo(row) {
        return {
            nodeType: row.node_type,
            name: row.name,
            displayName: row.display_name,
            description: row.description,
            category: row.category,
            subcategory: row.subcategory,
            icon: row.icon,
            sourceCode: row.source_code,
            credentialCode: row.credential_code,
            documentationMarkdown: row.documentation_markdown,
            documentationUrl: row.documentation_url,
            documentationTitle: row.documentation_title,
            operations: row.operations ? JSON.parse(row.operations) : null,
            apiMethods: row.api_methods ? JSON.parse(row.api_methods) : null,
            documentationExamples: row.documentation_examples ? JSON.parse(row.documentation_examples) : null,
            templates: row.templates ? JSON.parse(row.templates) : null,
            relatedResources: row.related_resources ? JSON.parse(row.related_resources) : null,
            requiredScopes: row.required_scopes ? JSON.parse(row.required_scopes) : null,
            exampleWorkflow: row.example_workflow ? JSON.parse(row.example_workflow) : null,
            exampleParameters: row.example_parameters ? JSON.parse(row.example_parameters) : null,
            propertiesSchema: row.properties_schema ? (0, compressed_column_1.decompressColumnJson)(row.properties_schema, null) : null,
            packageName: row.package_name,
            version: row.version,
            codexData: row.codex_data ? JSON.parse(row.codex_data) : null,
            aliases: row.aliases ? JSON.parse(row.aliases) : null,
            hasCredentials: row.has_credentials === 1,
            isTrigger: row.is_trigger === 1,
            isWebhook: row.is_webhook === 1
        };
    }
    generateHash(content) {
        return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
    }
    storeStatistics(stats) {
        if (!this.db)
            throw new Error('Database not initialized');
        const stmt = this.db.prepare(`
      INSERT INTO extraction_stats (
        total_nodes, nodes_with_docs, nodes_with_examples,
        total_code_size, total_docs_size
      ) VALUES (?, ?, ?, ?, ?)
    `);
        const sizeStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN documentation_markdown IS NOT NULL THEN 1 ELSE 0 END) as with_docs,
        SUM(CASE WHEN example_workflow IS NOT NULL THEN 1 ELSE 0 END) as with_examples,
        SUM(code_length) as code_size,
        SUM(LENGTH(documentation_markdown)) as docs_size
      FROM nodes
    `).get();
        stmt.run(stats.successful, sizeStats?.with_docs || 0, sizeStats?.with_examples || 0, sizeStats?.code_size || 0, sizeStats?.docs_size || 0);
    }
    async getStatistics() {
        await this.ensureInitialized();
        const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as totalNodes,
        COUNT(DISTINCT package_name) as totalPackages,
        SUM(code_length) as totalCodeSize,
        SUM(CASE WHEN documentation_markdown IS NOT NULL THEN 1 ELSE 0 END) as nodesWithDocs,
        SUM(CASE WHEN example_workflow IS NOT NULL THEN 1 ELSE 0 END) as nodesWithExamples,
        SUM(has_credentials) as nodesWithCredentials,
        SUM(is_trigger) as triggerNodes,
        SUM(is_webhook) as webhookNodes
      FROM nodes
    `).get();
        const packages = this.db.prepare(`
      SELECT package_name as package, COUNT(*) as count
      FROM nodes
      GROUP BY package_name
      ORDER BY count DESC
    `).all();
        return {
            totalNodes: stats?.totalNodes || 0,
            totalPackages: stats?.totalPackages || 0,
            totalCodeSize: stats?.totalCodeSize || 0,
            nodesWithDocs: stats?.nodesWithDocs || 0,
            nodesWithExamples: stats?.nodesWithExamples || 0,
            nodesWithCredentials: stats?.nodesWithCredentials || 0,
            triggerNodes: stats?.triggerNodes || 0,
            webhookNodes: stats?.webhookNodes || 0,
            packageDistribution: packages
        };
    }
    async close() {
        await this.ensureInitialized();
        this.db.close();
    }
}
exports.NodeDocumentationService = NodeDocumentationService;
//# sourceMappingURL=node-documentation-service.js.map