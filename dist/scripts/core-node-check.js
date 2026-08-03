"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CANONICAL_CORE_NODES = void 0;
exports.findMissingCoreNodes = findMissingCoreNodes;
exports.assertCoreNodesPresent = assertCoreNodesPresent;
exports.CANONICAL_CORE_NODES = [
    'nodes-base.code',
    'nodes-base.convertToFile',
    'nodes-base.evaluation',
    'nodes-base.evaluationTrigger',
    'nodes-base.executeWorkflow',
    'nodes-base.extractFromFile',
    'nodes-base.httpRequest',
    'nodes-base.if',
    'nodes-base.manualTrigger',
    'nodes-base.merge',
    'nodes-base.readWriteFile',
    'nodes-base.respondToWebhook',
    'nodes-base.scheduleTrigger',
    'nodes-base.set',
    'nodes-base.splitInBatches',
    'nodes-base.switch',
    'nodes-base.webhook'
];
function findMissingCoreNodes(lookup) {
    return exports.CANONICAL_CORE_NODES.filter(nodeType => !lookup.getNode(nodeType));
}
function assertCoreNodesPresent(lookup) {
    const missing = findMissingCoreNodes(lookup);
    if (missing.length > 0) {
        throw new Error(`Core node completeness check failed - missing from database: ${missing.join(', ')}. ` +
            'The rebuild dropped canonical core nodes; do not ship this database.');
    }
}
//# sourceMappingURL=core-node-check.js.map