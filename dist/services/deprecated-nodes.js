"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDeprecatedNodeVersion = isDeprecatedNodeVersion;
exports.deprecatedNodeReplacementHint = deprecatedNodeReplacementHint;
exports.deprecatedNodeMessage = deprecatedNodeMessage;
const node_parser_1 = require("../parsers/node-parser");
const REPLACEMENT_HINTS = {
    'nodes-base.function': 'Replace it with the Code node (n8n-nodes-base.code) in "Run Once for All Items" mode.',
    'nodes-base.functionItem': 'Replace it with the Code node (n8n-nodes-base.code) in "Run Once for Each Item" mode.',
};
const DEFAULT_HINT = 'Replace it with a supported node or remove it from the workflow.';
function isDeprecatedNodeVersion(nodeInfo, typeVersion) {
    const deprecated = nodeInfo.deprecatedVersions;
    if (!deprecated || deprecated.length === 0)
        return false;
    if (deprecated.includes(node_parser_1.ALL_VERSIONS))
        return true;
    const version = typeVersion ?? nodeInfo.version;
    if (version === undefined || version === null)
        return true;
    return deprecated.includes((0, node_parser_1.normalizeNodeVersion)(version));
}
function deprecatedNodeReplacementHint(nodeType) {
    return REPLACEMENT_HINTS[nodeType] ?? DEFAULT_HINT;
}
function deprecatedNodeMessage(workflowNodeType) {
    return (`"${workflowNodeType}" is deprecated. n8n 2.44+ (and 2.42.x/2.43.x patch releases) ` +
        'rejects saving a workflow that adds this node or changes it in any way other than moving it; ' +
        'an existing, unchanged node keeps running.');
}
//# sourceMappingURL=deprecated-nodes.js.map