#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_adapter_1 = require("../database/database-adapter");
const core_node_check_1 = require("./core-node-check");
async function validate() {
    const db = await (0, database_adapter_1.createDatabaseAdapter)('./data/nodes.db');
    console.log('🔍 Validating critical nodes...\n');
    const criticalChecks = [
        {
            type: 'nodes-base.httpRequest',
            checks: {
                hasDocumentation: true,
                documentationContains: 'HTTP Request',
                style: 'programmatic'
            }
        },
        {
            type: 'nodes-base.code',
            checks: {
                hasDocumentation: true,
                documentationContains: 'Code'
            }
        },
        {
            type: 'nodes-base.slack',
            checks: {
                hasOperations: true,
                style: 'programmatic'
            }
        },
        {
            type: 'nodes-langchain.agent',
            checks: {
                isAITool: false,
                packageName: '@n8n/n8n-nodes-langchain'
            }
        }
    ];
    let passed = 0;
    let failed = 0;
    for (const check of criticalChecks) {
        const node = db.prepare('SELECT * FROM nodes WHERE node_type = ?').get(check.type);
        if (!node) {
            console.log(`❌ ${check.type}: NOT FOUND`);
            failed++;
            continue;
        }
        let nodeOk = true;
        const issues = [];
        if (check.checks.hasDocumentation && !node.documentation) {
            nodeOk = false;
            issues.push('missing documentation');
        }
        if (check.checks.documentationContains &&
            !node.documentation?.includes(check.checks.documentationContains)) {
            nodeOk = false;
            issues.push(`documentation doesn't contain "${check.checks.documentationContains}"`);
        }
        if (check.checks.style && node.development_style !== check.checks.style) {
            nodeOk = false;
            issues.push(`wrong style: ${node.development_style}`);
        }
        if (check.checks.hasOperations) {
            const operations = JSON.parse(node.operations || '[]');
            if (!operations.length) {
                nodeOk = false;
                issues.push('no operations found');
            }
        }
        if (check.checks.isAITool !== undefined && !!node.is_ai_tool !== check.checks.isAITool) {
            nodeOk = false;
            issues.push(`AI tool flag mismatch: expected ${check.checks.isAITool}, got ${!!node.is_ai_tool}`);
        }
        if ('isVersioned' in check.checks && check.checks.isVersioned && !node.is_versioned) {
            nodeOk = false;
            issues.push('not marked as versioned');
        }
        if (check.checks.packageName && node.package_name !== check.checks.packageName) {
            nodeOk = false;
            issues.push(`wrong package: ${node.package_name}`);
        }
        if (nodeOk) {
            console.log(`✅ ${check.type}`);
            passed++;
        }
        else {
            console.log(`❌ ${check.type}: ${issues.join(', ')}`);
            failed++;
        }
    }
    console.log('\n🧩 Checking core node completeness...');
    const missingCoreNodes = (0, core_node_check_1.findMissingCoreNodes)({
        getNode: (nodeType) => db.prepare('SELECT node_type FROM nodes WHERE node_type = ?').get(nodeType)
    });
    if (missingCoreNodes.length > 0) {
        console.log(`❌ Missing core nodes: ${missingCoreNodes.join(', ')}`);
        failed += missingCoreNodes.length;
    }
    else {
        console.log(`✅ All ${core_node_check_1.CANONICAL_CORE_NODES.length} canonical core nodes present`);
        passed++;
    }
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(is_ai_tool) as ai_tools,
      SUM(is_trigger) as triggers,
      SUM(is_versioned) as versioned,
      COUNT(DISTINCT package_name) as packages
    FROM nodes
  `).get();
    console.log('\n📈 Database Statistics:');
    console.log(`   Total nodes: ${stats.total}`);
    console.log(`   AI tools: ${stats.ai_tools}`);
    console.log(`   Triggers: ${stats.triggers}`);
    console.log(`   Versioned: ${stats.versioned}`);
    console.log(`   Packages: ${stats.packages}`);
    const docStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN documentation IS NOT NULL THEN 1 ELSE 0 END) as with_docs
    FROM nodes
  `).get();
    console.log(`\n📚 Documentation Coverage:`);
    console.log(`   Nodes with docs: ${docStats.with_docs}/${docStats.total} (${Math.round(docStats.with_docs / docStats.total * 100)}%)`);
    db.close();
    process.exit(failed > 0 ? 1 : 0);
}
if (require.main === module) {
    validate().catch(error => {
        console.error(error);
        process.exit(1);
    });
}
//# sourceMappingURL=validate.js.map