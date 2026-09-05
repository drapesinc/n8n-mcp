"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowDiffEngine = void 0;
const uuid_1 = require("uuid");
const workflow_diff_1 = require("../types/workflow-diff");
const logger_1 = require("../utils/logger");
const node_groups_1 = require("./node-groups");
const node_sanitizer_1 = require("./node-sanitizer");
const node_type_utils_1 = require("../utils/node-type-utils");
const logger = new logger_1.Logger({ prefix: '[WorkflowDiffEngine]' });
const PATCH_LIMITS = {
    MAX_PATCHES: 50,
    MAX_REGEX_LENGTH: 500,
    MAX_FIELD_SIZE_REGEX: 512 * 1024,
};
const DANGEROUS_PATH_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function isUnsafeRegex(pattern) {
    const nestedQuantifier = /\([^)]*[+*][^)]*\)[+*{]/;
    if (nestedQuantifier.test(pattern))
        return true;
    const overlappingAlternation = /\([^)]*\|[^)]*\)[+*{]/;
    if (overlappingAlternation.test(pattern)) {
        const match = pattern.match(/\(([^)]*)\|([^)]*)\)[+*{]/);
        if (match) {
            const [, left, right] = match;
            const broadClasses = ['.', '\\w', '\\d', '\\s', '\\S', '\\W', '\\D', '[^'];
            const leftHasBroad = broadClasses.some(c => left.includes(c));
            const rightHasBroad = broadClasses.some(c => right.includes(c));
            if (leftHasBroad && rightHasBroad)
                return true;
        }
    }
    return false;
}
function parsePropertyPath(path) {
    const segments = [];
    for (const part of path.split('.')) {
        if (!part.includes('[') && !part.includes(']')) {
            if (part === '') {
                throw new Error(`Invalid property path "${path}": empty path segment. ` +
                    `Write "parameters.url" without leading, trailing or repeated dots.`);
            }
            segments.push({ key: part, bracket: false });
            continue;
        }
        const match = /^([^[\]]*)((?:\[\d+\])+)$/.exec(part);
        if (!match) {
            throw new Error(`Invalid property path "${path}": malformed bracket index in "${part}". ` +
                `Use "items[0].name" with a non-negative integer, or the equivalent "items.0.name".`);
        }
        const [, base, indices] = match;
        if (base)
            segments.push({ key: base, bracket: false });
        for (const [, index] of indices.matchAll(/\[(\d+)\]/g)) {
            segments.push({ key: index, bracket: true });
        }
    }
    return segments;
}
function resolveSegment(container, segment, path, forWrite) {
    if (Array.isArray(container)) {
        if (/^\d+$/.test(segment.key)) {
            const index = Number(segment.key);
            if (index >= container.length) {
                throw new Error(`Invalid property path "${path}": index ${index} is out of range for an array of ${container.length} item(s).`);
            }
            return index;
        }
        if (forWrite) {
            throw new Error(`Invalid property path "${path}": "${segment.key}" is not an array index. ` +
                `Address array elements by position, e.g. "items[0].name".`);
        }
    }
    if (segment.bracket) {
        throw new Error(`Invalid property path "${path}": "[${segment.key}]" expects an array but found ${container === null ? 'null' : typeof container}.`);
    }
    return segment.key;
}
function countOccurrences(str, search) {
    let count = 0;
    let pos = 0;
    while ((pos = str.indexOf(search, pos)) !== -1) {
        count++;
        pos += search.length;
    }
    return count;
}
const JS_CODE_FIELD_NAMES = new Set(['jsCode', 'functionCode']);
const AsyncFunctionCtor = (async () => { }).constructor;
const MAX_SYNTAX_CHECKED_LENGTH = 1000000;
function checkJsSyntax(code) {
    if (code.length > MAX_SYNTAX_CHECKED_LENGTH) {
        return { status: 'uncheckable', reason: `code exceeds ${MAX_SYNTAX_CHECKED_LENGTH} characters` };
    }
    try {
        new AsyncFunctionCtor(code);
        return { status: 'valid' };
    }
    catch (error) {
        if (error instanceof SyntaxError)
            return { status: 'invalid', message: error.message };
        return { status: 'uncheckable', reason: `the parser gave up (${error instanceof Error ? error.name : 'unknown error'})` };
    }
}
function stripExpressionPrefix(value) {
    return value.startsWith('=') ? value.slice(1) : value;
}
function assertPatchedJsSyntax(operation, fieldPath, patched, original) {
    const fieldName = fieldPath.split('.').pop() ?? '';
    if (!JS_CODE_FIELD_NAMES.has(fieldName))
        return;
    const patchedCheck = checkJsSyntax(stripExpressionPrefix(patched));
    if (patchedCheck.status === 'valid')
        return;
    if (checkJsSyntax(stripExpressionPrefix(original)).status !== 'valid')
        return;
    if (patchedCheck.status === 'invalid') {
        throw new Error(`${operation}: patches would leave "${fieldPath}" with invalid JavaScript (${patchedCheck.message}). ` +
            `The workflow was not modified. If several dependent edits pass through an invalid intermediate state, ` +
            `apply them as one operation — only the final result of the patches array is checked.`);
    }
    throw new Error(`${operation}: could not verify the JavaScript syntax of "${fieldPath}" after patching (${patchedCheck.reason}). ` +
        `The workflow was not modified. To set the field anyway, replace its full value with an updateNode operation, ` +
        `which is not syntax-checked.`);
}
function operationReferencesAddedNode(operation, addedNode) {
    if (operation.type === 'addConnection') {
        return operation.source === addedNode.name
            || operation.source === addedNode.id
            || operation.target === addedNode.name
            || operation.target === addedNode.id;
    }
    if (operation.type === 'rewireConnection') {
        return operation.source === addedNode.name
            || operation.source === addedNode.id
            || operation.from === addedNode.name
            || operation.from === addedNode.id
            || operation.to === addedNode.name
            || operation.to === addedNode.id;
    }
    return false;
}
function buildExecutionEntries(operations) {
    const entries = operations.map((operation, index) => ({ operation, index }));
    for (let currentIndex = 0; currentIndex < entries.length; currentIndex++) {
        const entry = entries[currentIndex];
        if (entry.operation.type !== 'addNode')
            continue;
        const addedNode = entry.operation.node;
        const referencedBeforeAdd = entries.findIndex((candidate, candidateIndex) => candidateIndex < currentIndex
            && (0, workflow_diff_1.isConnectionOperation)(candidate.operation)
            && operationReferencesAddedNode(candidate.operation, addedNode));
        if (referencedBeforeAdd === -1)
            continue;
        entries.splice(currentIndex, 1);
        entries.splice(referencedBeforeAdd, 0, entry);
    }
    return entries;
}
class WorkflowDiffEngine {
    constructor() {
        this.renameMap = new Map();
        this.warnings = [];
        this.modifiedNodeIds = new Set();
        this.removedNodeNames = new Set();
        this.tagsToAdd = [];
        this.tagsToRemove = [];
        this.authoredGroupNames = new Set();
    }
    async applyDiff(workflow, request) {
        try {
            this.renameMap.clear();
            this.warnings = [];
            this.modifiedNodeIds.clear();
            this.removedNodeNames.clear();
            this.tagsToAdd = [];
            this.tagsToRemove = [];
            this.transferToProjectId = undefined;
            this.authoredGroupNames.clear();
            const workflowCopy = JSON.parse(JSON.stringify(workflow));
            const operationEntries = buildExecutionEntries(request.operations);
            const nodeOperationCount = request.operations.filter(workflow_diff_1.isNodeOperation).length;
            const otherOperationCount = request.operations.length - nodeOperationCount;
            const errors = [];
            const appliedIndices = [];
            const failedIndices = [];
            if (request.continueOnError) {
                for (const { operation, index } of operationEntries) {
                    const error = this.validateOperation(workflowCopy, operation);
                    if (error) {
                        errors.push({
                            operation: index,
                            message: error,
                            details: operation
                        });
                        failedIndices.push(index);
                        continue;
                    }
                    try {
                        this.applyOperation(workflowCopy, operation);
                        this.flushPendingRenames(workflowCopy);
                        appliedIndices.push(index);
                    }
                    catch (error) {
                        const errorMsg = `Failed to apply operation: ${error instanceof Error ? error.message : 'Unknown error'}`;
                        errors.push({
                            operation: index,
                            message: errorMsg,
                            details: operation
                        });
                        failedIndices.push(index);
                    }
                }
                this.finalizeNodeGroups(workflowCopy);
                if (request.validateOnly) {
                    return {
                        success: errors.length === 0,
                        workflow: workflowCopy,
                        message: errors.length === 0
                            ? 'Validation successful. All operations are valid.'
                            : `Validation completed with ${errors.length} errors.`,
                        errors: errors.length > 0 ? errors : undefined,
                        warnings: this.warnings.length > 0 ? this.warnings : undefined,
                        applied: appliedIndices,
                        failed: failedIndices,
                        authoredGroupNames: this.authoredGroupNamesOrUndefined()
                    };
                }
                const shouldActivate = workflowCopy._shouldActivate === true;
                const shouldDeactivate = workflowCopy._shouldDeactivate === true;
                delete workflowCopy._shouldActivate;
                delete workflowCopy._shouldDeactivate;
                const success = appliedIndices.length > 0;
                return {
                    success,
                    workflow: workflowCopy,
                    operationsApplied: appliedIndices.length,
                    message: `Applied ${appliedIndices.length} operations, ${failedIndices.length} failed (continueOnError mode)`,
                    errors: errors.length > 0 ? errors : undefined,
                    warnings: this.warnings.length > 0 ? this.warnings : undefined,
                    applied: appliedIndices,
                    failed: failedIndices,
                    shouldActivate: shouldActivate || undefined,
                    shouldDeactivate: shouldDeactivate || undefined,
                    tagsToAdd: this.tagsToAdd.length > 0 ? this.tagsToAdd : undefined,
                    tagsToRemove: this.tagsToRemove.length > 0 ? this.tagsToRemove : undefined,
                    transferToProjectId: this.transferToProjectId || undefined,
                    authoredGroupNames: this.authoredGroupNamesOrUndefined()
                };
            }
            else {
                for (const { operation, index } of operationEntries) {
                    const error = this.validateOperation(workflowCopy, operation);
                    if (error) {
                        return {
                            success: false,
                            errors: [{
                                    operation: index,
                                    message: error,
                                    details: operation
                                }]
                        };
                    }
                    try {
                        this.applyOperation(workflowCopy, operation);
                        this.flushPendingRenames(workflowCopy);
                    }
                    catch (error) {
                        return {
                            success: false,
                            errors: [{
                                    operation: index,
                                    message: `Failed to apply operation: ${error instanceof Error ? error.message : 'Unknown error'}`,
                                    details: operation
                                }]
                        };
                    }
                }
                if (this.modifiedNodeIds.size > 0) {
                    workflowCopy.nodes = workflowCopy.nodes.map((node) => {
                        if (this.modifiedNodeIds.has(node.id)) {
                            return (0, node_sanitizer_1.sanitizeNode)(node);
                        }
                        return node;
                    });
                    logger.debug(`Sanitized ${this.modifiedNodeIds.size} modified nodes`);
                }
                this.finalizeNodeGroups(workflowCopy);
                if (request.validateOnly) {
                    return {
                        success: true,
                        workflow: workflowCopy,
                        message: 'Validation successful. Operations are valid but not applied.',
                        warnings: this.warnings.length > 0 ? this.warnings : undefined,
                        authoredGroupNames: this.authoredGroupNamesOrUndefined()
                    };
                }
                const operationsApplied = request.operations.length;
                const shouldActivate = workflowCopy._shouldActivate === true;
                const shouldDeactivate = workflowCopy._shouldDeactivate === true;
                delete workflowCopy._shouldActivate;
                delete workflowCopy._shouldDeactivate;
                return {
                    success: true,
                    workflow: workflowCopy,
                    operationsApplied,
                    message: `Successfully applied ${operationsApplied} operations (${nodeOperationCount} node ops, ${otherOperationCount} other ops)`,
                    warnings: this.warnings.length > 0 ? this.warnings : undefined,
                    shouldActivate: shouldActivate || undefined,
                    shouldDeactivate: shouldDeactivate || undefined,
                    tagsToAdd: this.tagsToAdd.length > 0 ? this.tagsToAdd : undefined,
                    tagsToRemove: this.tagsToRemove.length > 0 ? this.tagsToRemove : undefined,
                    transferToProjectId: this.transferToProjectId || undefined,
                    authoredGroupNames: this.authoredGroupNamesOrUndefined()
                };
            }
        }
        catch (error) {
            logger.error('Failed to apply diff', error);
            return {
                success: false,
                errors: [{
                        operation: -1,
                        message: `Diff engine error: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }]
            };
        }
    }
    validateOperation(workflow, operation) {
        switch (operation.type) {
            case 'addNode':
                return this.validateAddNode(workflow, operation);
            case 'removeNode':
                return this.validateRemoveNode(workflow, operation);
            case 'updateNode':
                return this.validateUpdateNode(workflow, operation);
            case 'patchNodeField':
                return this.validatePatchNodeField(workflow, operation);
            case 'moveNode':
                return this.validateMoveNode(workflow, operation);
            case 'enableNode':
            case 'disableNode':
                return this.validateToggleNode(workflow, operation);
            case 'addConnection':
                return this.validateAddConnection(workflow, operation);
            case 'removeConnection':
                return this.validateRemoveConnection(workflow, operation);
            case 'rewireConnection':
                return this.validateRewireConnection(workflow, operation);
            case 'updateSettings':
            case 'updateName':
            case 'addTag':
            case 'removeTag':
                return null;
            case 'setNodeGroups':
                return this.validateSetNodeGroups(workflow, operation);
            case 'transferWorkflow':
                return this.validateTransferWorkflow(workflow, operation);
            case 'moveToFolder':
                return this.validateMoveToFolder(workflow, operation);
            case 'activateWorkflow':
                return this.validateActivateWorkflow(workflow, operation);
            case 'deactivateWorkflow':
                return this.validateDeactivateWorkflow(workflow, operation);
            case 'cleanStaleConnections':
                return this.validateCleanStaleConnections(workflow, operation);
            case 'replaceConnections':
                return this.validateReplaceConnections(workflow, operation);
            default:
                return `Unknown operation type: ${operation.type}`;
        }
    }
    applyOperation(workflow, operation) {
        switch (operation.type) {
            case 'addNode':
                this.applyAddNode(workflow, operation);
                break;
            case 'removeNode':
                this.applyRemoveNode(workflow, operation);
                break;
            case 'updateNode':
                this.applyUpdateNode(workflow, operation);
                break;
            case 'patchNodeField':
                this.applyPatchNodeField(workflow, operation);
                break;
            case 'moveNode':
                this.applyMoveNode(workflow, operation);
                break;
            case 'enableNode':
                this.applyEnableNode(workflow, operation);
                break;
            case 'disableNode':
                this.applyDisableNode(workflow, operation);
                break;
            case 'addConnection':
                this.applyAddConnection(workflow, operation);
                break;
            case 'removeConnection':
                this.applyRemoveConnection(workflow, operation);
                break;
            case 'rewireConnection':
                this.applyRewireConnection(workflow, operation);
                break;
            case 'updateSettings':
                this.applyUpdateSettings(workflow, operation);
                break;
            case 'updateName':
                this.applyUpdateName(workflow, operation);
                break;
            case 'setNodeGroups':
                this.applySetNodeGroups(workflow, operation);
                break;
            case 'addTag':
                this.applyAddTag(workflow, operation);
                break;
            case 'removeTag':
                this.applyRemoveTag(workflow, operation);
                break;
            case 'activateWorkflow':
                this.applyActivateWorkflow(workflow, operation);
                break;
            case 'deactivateWorkflow':
                this.applyDeactivateWorkflow(workflow, operation);
                break;
            case 'cleanStaleConnections':
                this.applyCleanStaleConnections(workflow, operation);
                break;
            case 'replaceConnections':
                this.applyReplaceConnections(workflow, operation);
                break;
            case 'transferWorkflow':
                this.applyTransferWorkflow(workflow, operation);
                break;
            case 'moveToFolder':
                this.applyMoveToFolder(workflow, operation);
                break;
        }
    }
    validateAddNode(workflow, operation) {
        const { node } = operation;
        const normalizedNewName = this.normalizeNodeName(node.name);
        const duplicate = workflow.nodes.find(n => this.normalizeNodeName(n.name) === normalizedNewName);
        if (duplicate) {
            return `Node with name "${node.name}" already exists (normalized name matches existing node "${duplicate.name}")`;
        }
        if (!node.type.includes('.')) {
            return `Invalid node type "${node.type}". Must include package prefix (e.g., "n8n-nodes-base.webhook")`;
        }
        if (node.type.startsWith('nodes-base.')) {
            return `Invalid node type "${node.type}". Use "n8n-nodes-base.${node.type.substring(11)}" instead`;
        }
        return null;
    }
    validateRemoveNode(workflow, operation) {
        const node = this.findNode(workflow, operation.nodeId, operation.nodeName);
        if (!node) {
            return this.formatNodeNotFoundError(workflow, operation.nodeId || operation.nodeName || '', 'removeNode');
        }
        const hasConnections = Object.values(workflow.connections).some(conn => {
            return Object.values(conn).some(outputs => outputs.some(connections => connections.some(c => c.node === node.name)));
        });
        if (hasConnections || workflow.connections[node.name]) {
            logger.warn(`Removing node "${node.name}" will break existing connections`);
        }
        return null;
    }
    validateUpdateNode(workflow, operation) {
        const operationAny = operation;
        if (operationAny.changes && !operation.updates) {
            return `Invalid parameter 'changes'. The updateNode operation requires 'updates' (not 'changes'). Example: {type: "updateNode", nodeId: "abc", updates: {name: "New Name", "parameters.url": "https://example.com"}}`;
        }
        if (!operation.updates) {
            return `Missing required parameter 'updates'. The updateNode operation requires an 'updates' object. Correct structure: {type: "updateNode", nodeId: "abc-123" OR nodeName: "My Node", updates: {name: "New Name", "parameters.url": "https://example.com"}}`;
        }
        const node = this.findNode(workflow, operation.nodeId, operation.nodeName);
        if (!node) {
            return this.formatNodeNotFoundError(workflow, operation.nodeId || operation.nodeName || '', 'updateNode');
        }
        if ('id' in operation.updates && operation.updates.id !== node.id) {
            return `Cannot change the id of node "${node.name}": node IDs are immutable because canvas groups and pinned data reference them. Remove and re-add the node instead.`;
        }
        if (operation.updates.name && operation.updates.name !== node.name) {
            const normalizedNewName = this.normalizeNodeName(operation.updates.name);
            const normalizedCurrentName = this.normalizeNodeName(node.name);
            if (normalizedNewName !== normalizedCurrentName) {
                const collision = workflow.nodes.find(n => n.id !== node.id && this.normalizeNodeName(n.name) === normalizedNewName);
                if (collision) {
                    return `Cannot rename node "${node.name}" to "${operation.updates.name}": A node with that name already exists (id: ${collision.id.substring(0, 8)}...). Please choose a different name.`;
                }
            }
        }
        for (const [path, value] of Object.entries(operation.updates)) {
            try {
                parsePropertyPath(path);
            }
            catch (error) {
                return error instanceof Error ? error.message : `Invalid property path "${path}"`;
            }
            if (value !== null && typeof value === 'object' && !Array.isArray(value)
                && '__patch_find_replace' in value) {
                const patches = value.__patch_find_replace;
                if (!Array.isArray(patches)) {
                    return `Invalid __patch_find_replace at "${path}": must be an array of {find, replace} objects`;
                }
                for (let i = 0; i < patches.length; i++) {
                    const patch = patches[i];
                    if (!patch || typeof patch.find !== 'string' || typeof patch.replace !== 'string') {
                        return `Invalid __patch_find_replace entry at "${path}[${i}]": each entry must have "find" (string) and "replace" (string)`;
                    }
                }
                const currentValue = this.getNestedProperty(node, path);
                if (currentValue === undefined) {
                    return `Cannot apply __patch_find_replace to "${path}": property does not exist on node`;
                }
                if (typeof currentValue !== 'string') {
                    return `Cannot apply __patch_find_replace to "${path}": current value is ${typeof currentValue}, expected string`;
                }
            }
        }
        return null;
    }
    validatePatchNodeField(workflow, operation) {
        if (!operation.nodeId && !operation.nodeName) {
            return `patchNodeField requires either "nodeId" or "nodeName"`;
        }
        if (!operation.fieldPath || typeof operation.fieldPath !== 'string') {
            return `patchNodeField requires a "fieldPath" string (e.g., "parameters.jsCode")`;
        }
        let pathSegments;
        try {
            pathSegments = parsePropertyPath(operation.fieldPath);
        }
        catch (error) {
            const reason = error instanceof Error
                ? error.message
                : `invalid fieldPath "${operation.fieldPath}"`;
            return `patchNodeField: ${reason}`;
        }
        if (pathSegments.some(s => DANGEROUS_PATH_KEYS.has(s.key))) {
            return `patchNodeField: fieldPath "${operation.fieldPath}" contains a forbidden key (__proto__, constructor, or prototype)`;
        }
        if (pathSegments[0].key === 'id') {
            return `Cannot patch the id of a node: node IDs are immutable because canvas groups and pinned data reference them. Remove and re-add the node instead.`;
        }
        if (!Array.isArray(operation.patches) || operation.patches.length === 0) {
            return `patchNodeField requires a non-empty "patches" array of {find, replace} objects`;
        }
        if (operation.patches.length > PATCH_LIMITS.MAX_PATCHES) {
            return `patchNodeField: too many patches (${operation.patches.length}). Maximum is ${PATCH_LIMITS.MAX_PATCHES} per operation. Split into multiple operations if needed.`;
        }
        for (let i = 0; i < operation.patches.length; i++) {
            const patch = operation.patches[i];
            if (!patch || typeof patch.find !== 'string' || typeof patch.replace !== 'string') {
                return `Invalid patch entry at index ${i}: each entry must have "find" (string) and "replace" (string)`;
            }
            if (patch.find.length === 0) {
                return `Invalid patch entry at index ${i}: "find" must not be empty`;
            }
            if (patch.regex) {
                if (patch.find.length > PATCH_LIMITS.MAX_REGEX_LENGTH) {
                    return `Regex pattern at patch index ${i} is too long (${patch.find.length} chars). Maximum is ${PATCH_LIMITS.MAX_REGEX_LENGTH} characters.`;
                }
                try {
                    new RegExp(patch.find);
                }
                catch (e) {
                    return `Invalid regex pattern at patch index ${i}: ${e instanceof Error ? e.message : 'invalid regex'}`;
                }
                if (isUnsafeRegex(patch.find)) {
                    return `Potentially unsafe regex pattern at patch index ${i}: nested quantifiers or overlapping alternations can cause excessive backtracking. Simplify the pattern or use literal matching (regex: false).`;
                }
            }
        }
        const node = this.findNode(workflow, operation.nodeId, operation.nodeName);
        if (!node) {
            return this.formatNodeNotFoundError(workflow, operation.nodeId || operation.nodeName || '', 'patchNodeField');
        }
        const currentValue = this.getNestedProperty(node, operation.fieldPath);
        if (currentValue === undefined) {
            return `Cannot apply patchNodeField to "${operation.fieldPath}": property does not exist on node "${node.name}"`;
        }
        if (typeof currentValue !== 'string') {
            return `Cannot apply patchNodeField to "${operation.fieldPath}": current value is ${typeof currentValue}, expected string`;
        }
        const hasRegex = operation.patches.some(p => p.regex);
        if (hasRegex && typeof currentValue === 'string' && currentValue.length > PATCH_LIMITS.MAX_FIELD_SIZE_REGEX) {
            return `Field "${operation.fieldPath}" is too large for regex operations (${Math.round(currentValue.length / 1024)}KB). Maximum is ${PATCH_LIMITS.MAX_FIELD_SIZE_REGEX / 1024}KB. Use literal matching (regex: false) for large fields.`;
        }
        return null;
    }
    validateMoveNode(workflow, operation) {
        const operationAny = operation;
        if (operationAny.newPosition !== undefined) {
            return `Invalid parameter 'newPosition' for moveNode. Did you mean 'position'? Example: {type: "moveNode", nodeName: "My Node", position: [450, 600]}`;
        }
        const node = this.findNode(workflow, operation.nodeId, operation.nodeName);
        if (!node) {
            return this.formatNodeNotFoundError(workflow, operation.nodeId || operation.nodeName || '', 'moveNode');
        }
        if (!operation.position) {
            return `Missing required parameter 'position' for moveNode. Example: {type: "moveNode", nodeName: "${node.name}", position: [450, 600]}`;
        }
        if (!Array.isArray(operation.position) || operation.position.length !== 2 ||
            typeof operation.position[0] !== 'number' || typeof operation.position[1] !== 'number') {
            return `Invalid 'position' for moveNode. Must be [x, y] with two numbers. Got: ${JSON.stringify(operation.position)}`;
        }
        return null;
    }
    validateToggleNode(workflow, operation) {
        const node = this.findNode(workflow, operation.nodeId, operation.nodeName);
        if (!node) {
            const operationType = operation.type === 'enableNode' ? 'enableNode' : 'disableNode';
            return this.formatNodeNotFoundError(workflow, operation.nodeId || operation.nodeName || '', operationType);
        }
        return null;
    }
    validateAddConnection(workflow, operation) {
        const operationAny = operation;
        if (operationAny.sourceNodeId || operationAny.targetNodeId) {
            const wrongParams = [];
            if (operationAny.sourceNodeId)
                wrongParams.push('sourceNodeId');
            if (operationAny.targetNodeId)
                wrongParams.push('targetNodeId');
            return `Invalid parameter(s): ${wrongParams.join(', ')}. Use 'source' and 'target' instead. Example: {type: "addConnection", source: "Node Name", target: "Target Name"}`;
        }
        if (!operation.source) {
            return `Missing required parameter 'source'. The addConnection operation requires both 'source' and 'target' parameters. Check that you're using 'source' (not 'sourceNodeId').`;
        }
        if (!operation.target) {
            return `Missing required parameter 'target'. The addConnection operation requires both 'source' and 'target' parameters. Check that you're using 'target' (not 'targetNodeId').`;
        }
        const sourceNode = this.findNode(workflow, operation.source, operation.source);
        const targetNode = this.findNode(workflow, operation.target, operation.target);
        if (!sourceNode) {
            const availableNodes = workflow.nodes
                .map(n => `"${n.name}" (id: ${n.id.substring(0, 8)}...)`)
                .join(', ');
            return `Source node not found: "${operation.source}". Available nodes: ${availableNodes}. Tip: Use node ID for names with special characters (apostrophes, quotes).`;
        }
        if (!targetNode) {
            const availableNodes = workflow.nodes
                .map(n => `"${n.name}" (id: ${n.id.substring(0, 8)}...)`)
                .join(', ');
            return `Target node not found: "${operation.target}". Available nodes: ${availableNodes}. Tip: Use node ID for names with special characters (apostrophes, quotes).`;
        }
        const { sourceOutput, sourceIndex } = this.resolveSmartParameters(workflow, operation, { silent: true });
        const existing = workflow.connections[sourceNode.name]?.[sourceOutput];
        if (existing) {
            const slot = existing[sourceIndex];
            if (Array.isArray(slot) && slot.some(c => c.node === targetNode.name)) {
                return `Connection already exists from "${sourceNode.name}" (output "${sourceOutput}", index ${sourceIndex}) to "${targetNode.name}"`;
            }
        }
        return null;
    }
    validateRemoveConnection(workflow, operation) {
        if (operation.ignoreErrors) {
            return null;
        }
        const sourceNode = this.findNode(workflow, operation.source, operation.source);
        const targetNode = this.findNode(workflow, operation.target, operation.target);
        if (!sourceNode) {
            if (this.removedNodeNames.has(operation.source)) {
                return `Source node "${operation.source}" was already removed by a prior removeNode operation. Its connections were automatically cleaned up — no separate removeConnection needed.`;
            }
            const availableNodes = workflow.nodes
                .map(n => `"${n.name}" (id: ${n.id.substring(0, 8)}...)`)
                .join(', ');
            return `Source node not found: "${operation.source}". Available nodes: ${availableNodes}. Tip: Use node ID for names with special characters.`;
        }
        if (!targetNode) {
            if (this.removedNodeNames.has(operation.target)) {
                return `Target node "${operation.target}" was already removed by a prior removeNode operation. Its connections were automatically cleaned up — no separate removeConnection needed.`;
            }
            const availableNodes = workflow.nodes
                .map(n => `"${n.name}" (id: ${n.id.substring(0, 8)}...)`)
                .join(', ');
            return `Target node not found: "${operation.target}". Available nodes: ${availableNodes}. Tip: Use node ID for names with special characters.`;
        }
        const sourceOutput = operation.sourceOutput || 'main';
        const connections = workflow.connections[sourceNode.name]?.[sourceOutput];
        if (!connections) {
            return `No connections found from "${sourceNode.name}"`;
        }
        const hasConnection = connections.some(conns => conns.some(c => c.node === targetNode.name));
        if (!hasConnection) {
            return `No connection exists from "${sourceNode.name}" to "${targetNode.name}"`;
        }
        return null;
    }
    validateRewireConnection(workflow, operation) {
        if (operation.from === operation.to) {
            return `rewireConnection: "from" and "to" must refer to different nodes (got "${operation.from}" for both).`;
        }
        const sourceNode = this.findNode(workflow, operation.source, operation.source);
        if (!sourceNode) {
            const availableNodes = workflow.nodes
                .map(n => `"${n.name}" (id: ${n.id.substring(0, 8)}...)`)
                .join(', ');
            return `Source node not found: "${operation.source}". Available nodes: ${availableNodes}. Tip: Use node ID for names with special characters.`;
        }
        const fromNode = this.findNode(workflow, operation.from, operation.from);
        if (!fromNode) {
            const availableNodes = workflow.nodes
                .map(n => `"${n.name}" (id: ${n.id.substring(0, 8)}...)`)
                .join(', ');
            return `"From" node not found: "${operation.from}". Available nodes: ${availableNodes}. Tip: Use node ID for names with special characters.`;
        }
        const toNode = this.findNode(workflow, operation.to, operation.to);
        if (!toNode) {
            const availableNodes = workflow.nodes
                .map(n => `"${n.name}" (id: ${n.id.substring(0, 8)}...)`)
                .join(', ');
            return `"To" node not found: "${operation.to}". Available nodes: ${availableNodes}. Tip: Use node ID for names with special characters.`;
        }
        const { sourceOutput, sourceIndex } = this.resolveSmartParameters(workflow, operation, { silent: true });
        const connections = workflow.connections[sourceNode.name]?.[sourceOutput];
        if (!connections) {
            return `No connections found from "${sourceNode.name}" on output "${sourceOutput}"`;
        }
        if (!connections[sourceIndex]) {
            return `No connections found from "${sourceNode.name}" on output "${sourceOutput}" at index ${sourceIndex}`;
        }
        const hasConnection = connections[sourceIndex].some(c => c.node === fromNode.name);
        if (!hasConnection) {
            return `No connection exists from "${sourceNode.name}" to "${fromNode.name}" on output "${sourceOutput}" at index ${sourceIndex}"`;
        }
        return null;
    }
    applyAddNode(workflow, operation) {
        const newNode = {
            id: operation.node.id || (0, uuid_1.v4)(),
            name: operation.node.name,
            type: operation.node.type,
            typeVersion: operation.node.typeVersion || 1,
            position: operation.node.position,
            parameters: operation.node.parameters || {},
            credentials: operation.node.credentials,
            disabled: operation.node.disabled,
            notes: operation.node.notes,
            notesInFlow: operation.node.notesInFlow,
            continueOnFail: operation.node.continueOnFail,
            onError: operation.node.onError,
            retryOnFail: operation.node.retryOnFail,
            maxTries: operation.node.maxTries,
            waitBetweenTries: operation.node.waitBetweenTries,
            alwaysOutputData: operation.node.alwaysOutputData,
            executeOnce: operation.node.executeOnce
        };
        const sanitizedNode = (0, node_sanitizer_1.sanitizeNode)(newNode);
        this.modifiedNodeIds.add(sanitizedNode.id);
        workflow.nodes.push(sanitizedNode);
    }
    applyRemoveNode(workflow, operation) {
        const node = this.findNode(workflow, operation.nodeId, operation.nodeName);
        if (!node)
            return;
        this.removedNodeNames.add(node.name);
        const index = workflow.nodes.findIndex(n => n.id === node.id);
        if (index !== -1) {
            workflow.nodes.splice(index, 1);
        }
        delete workflow.connections[node.name];
        for (const [sourceName, sourceConnections] of Object.entries(workflow.connections)) {
            for (const [outputName, outputConns] of Object.entries(sourceConnections)) {
                sourceConnections[outputName] = outputConns.map(connections => connections.filter(conn => conn.node !== node.name));
                const trimmed = sourceConnections[outputName];
                while (trimmed.length > 0 && trimmed[trimmed.length - 1].length === 0) {
                    trimmed.pop();
                }
                if (trimmed.length === 0) {
                    delete sourceConnections[outputName];
                }
            }
            if (Object.keys(sourceConnections).length === 0) {
                delete workflow.connections[sourceName];
            }
        }
    }
    applyUpdateNode(workflow, operation) {
        const node = this.findNode(workflow, operation.nodeId, operation.nodeName);
        if (!node)
            return;
        this.modifiedNodeIds.add(node.id);
        const pendingRename = operation.updates.name && operation.updates.name !== node.name
            ? { oldName: node.name, newName: operation.updates.name }
            : undefined;
        const draft = JSON.parse(JSON.stringify(node));
        this.orderUpdateEntries(operation.updates).forEach(([path, value]) => {
            if (value !== null && typeof value === 'object' && !Array.isArray(value)
                && '__patch_find_replace' in value) {
                const patches = value.__patch_find_replace;
                const original = this.getNestedProperty(draft, path);
                let current = original;
                for (const patch of patches) {
                    if (!current.includes(patch.find)) {
                        this.warnings.push({
                            operation: -1,
                            message: `__patch_find_replace: "${patch.find.substring(0, 50)}" not found in "${path}". Skipped.`
                        });
                        continue;
                    }
                    current = current.replace(patch.find, () => patch.replace);
                }
                assertPatchedJsSyntax('__patch_find_replace', path, current, original);
                this.setNestedProperty(draft, path, current);
            }
            else {
                this.setNestedProperty(draft, path, value);
            }
        });
        const sanitized = (0, node_sanitizer_1.sanitizeNode)(draft);
        for (const key of Object.keys(node)) {
            if (!Object.prototype.hasOwnProperty.call(sanitized, key)) {
                delete node[key];
            }
        }
        Object.assign(node, sanitized);
        if (pendingRename && node.name === pendingRename.newName) {
            this.renameMap.set(pendingRename.oldName, pendingRename.newName);
            logger.debug(`Tracking rename: "${pendingRename.oldName}" → "${pendingRename.newName}"`);
        }
    }
    orderUpdateEntries(updates) {
        const entries = Object.entries(updates);
        const removalsByParent = new Map();
        entries.forEach(([path, value], position) => {
            if (value !== null && value !== undefined)
                return;
            const segments = parsePropertyPath(path);
            const lastSegment = segments[segments.length - 1];
            if (!/^\d+$/.test(lastSegment.key))
                return;
            const parent = segments.slice(0, -1).map(s => s.key).join('.');
            const removals = removalsByParent.get(parent) ?? [];
            removals.push({ position, index: Number(lastSegment.key) });
            removalsByParent.set(parent, removals);
        });
        const ordered = [...entries];
        for (const removals of removalsByParent.values()) {
            if (removals.length < 2)
                continue;
            const descending = [...removals].sort((a, b) => b.index - a.index);
            removals.forEach(({ position }, i) => {
                ordered[position] = entries[descending[i].position];
            });
        }
        return ordered;
    }
    applyPatchNodeField(workflow, operation) {
        const node = this.findNode(workflow, operation.nodeId, operation.nodeName);
        if (!node)
            return;
        this.modifiedNodeIds.add(node.id);
        const original = this.getNestedProperty(node, operation.fieldPath);
        let current = original;
        for (let i = 0; i < operation.patches.length; i++) {
            const patch = operation.patches[i];
            if (patch.regex) {
                const globalRegex = new RegExp(patch.find, 'g');
                const matches = current.match(globalRegex);
                if (!matches || matches.length === 0) {
                    throw new Error(`patchNodeField: regex pattern "${patch.find}" not found in "${operation.fieldPath}" (patch index ${i}). ` +
                        `Use n8n_get_workflow to inspect the current value.`);
                }
                if (matches.length > 1 && !patch.replaceAll) {
                    throw new Error(`patchNodeField: regex pattern "${patch.find}" matches ${matches.length} times in "${operation.fieldPath}" (patch index ${i}). ` +
                        `Set "replaceAll": true to replace all occurrences, or refine the pattern to match exactly once.`);
                }
                const regex = patch.replaceAll ? globalRegex : new RegExp(patch.find);
                current = current.replace(regex, patch.replace);
            }
            else {
                const occurrences = countOccurrences(current, patch.find);
                if (occurrences === 0) {
                    throw new Error(`patchNodeField: "${patch.find.substring(0, 80)}" not found in "${operation.fieldPath}" (patch index ${i}). ` +
                        `Ensure the find string exactly matches the current content (including whitespace and newlines). ` +
                        `Use n8n_get_workflow to inspect the current value.`);
                }
                if (occurrences > 1 && !patch.replaceAll) {
                    throw new Error(`patchNodeField: "${patch.find.substring(0, 80)}" found ${occurrences} times in "${operation.fieldPath}" (patch index ${i}). ` +
                        `Set "replaceAll": true to replace all occurrences, or use a more specific find string that matches exactly once.`);
                }
                current = current.split(patch.find).join(patch.replace);
            }
        }
        assertPatchedJsSyntax('patchNodeField', operation.fieldPath, current, original);
        this.setNestedProperty(node, operation.fieldPath, current);
        const sanitized = (0, node_sanitizer_1.sanitizeNode)(node);
        Object.assign(node, sanitized);
    }
    applyMoveNode(workflow, operation) {
        const node = this.findNode(workflow, operation.nodeId, operation.nodeName);
        if (!node)
            return;
        node.position = operation.position;
    }
    applyEnableNode(workflow, operation) {
        const node = this.findNode(workflow, operation.nodeId, operation.nodeName);
        if (!node)
            return;
        node.disabled = false;
    }
    applyDisableNode(workflow, operation) {
        const node = this.findNode(workflow, operation.nodeId, operation.nodeName);
        if (!node)
            return;
        node.disabled = true;
    }
    resolveSmartParameters(workflow, operation, options = {}) {
        const sourceNode = this.findNode(workflow, operation.source, operation.source);
        let sourceOutput = String(operation.sourceOutput ?? 'main');
        let sourceIndex = operation.sourceIndex ?? 0;
        const numericOutput = /^\d+$/.test(sourceOutput) ? parseInt(sourceOutput, 10) : null;
        if (numericOutput !== null
            && (operation.sourceIndex === undefined || operation.sourceIndex === numericOutput)
            && operation.branch === undefined && operation.case === undefined) {
            sourceIndex = numericOutput;
            sourceOutput = 'main';
        }
        if (operation.branch !== undefined && operation.sourceIndex === undefined) {
            if (sourceNode?.type === 'n8n-nodes-base.if') {
                sourceIndex = operation.branch === 'true' ? 0 : 1;
            }
        }
        if (operation.case !== undefined && operation.sourceIndex === undefined) {
            sourceIndex = operation.case;
        }
        if (!options.silent && sourceNode && operation.sourceIndex !== undefined && operation.branch === undefined && operation.case === undefined) {
            if (sourceNode.type === 'n8n-nodes-base.if') {
                this.warnings.push({
                    operation: -1,
                    message: `Connection to If node "${operation.source}" uses sourceIndex=${operation.sourceIndex}. ` +
                        `Consider using branch="true" or branch="false" for better clarity. ` +
                        `If node outputs: main[0]=TRUE branch, main[1]=FALSE branch.`
                });
            }
            else if (sourceNode.type === 'n8n-nodes-base.switch') {
                this.warnings.push({
                    operation: -1,
                    message: `Connection to Switch node "${operation.source}" uses sourceIndex=${operation.sourceIndex}. ` +
                        `Consider using case=N for better clarity (case=0 for first output, case=1 for second, etc.).`
                });
            }
        }
        return { sourceOutput, sourceIndex };
    }
    applyAddConnection(workflow, operation) {
        const sourceNode = this.findNode(workflow, operation.source, operation.source);
        const targetNode = this.findNode(workflow, operation.target, operation.target);
        if (!sourceNode || !targetNode)
            return;
        const { sourceOutput, sourceIndex } = this.resolveSmartParameters(workflow, operation);
        let targetInput = String(operation.targetInput ?? sourceOutput);
        if (/^\d+$/.test(targetInput)) {
            targetInput = 'main';
        }
        const targetIndex = operation.targetIndex ?? 0;
        if (!workflow.connections[sourceNode.name]) {
            workflow.connections[sourceNode.name] = {};
        }
        if (!workflow.connections[sourceNode.name][sourceOutput]) {
            workflow.connections[sourceNode.name][sourceOutput] = [];
        }
        const outputArray = workflow.connections[sourceNode.name][sourceOutput];
        while (outputArray.length <= sourceIndex) {
            outputArray.push([]);
        }
        if (!Array.isArray(outputArray[sourceIndex])) {
            outputArray[sourceIndex] = [];
        }
        outputArray[sourceIndex].push({
            node: targetNode.name,
            type: targetInput,
            index: targetIndex
        });
    }
    applyRemoveConnection(workflow, operation) {
        const sourceNode = this.findNode(workflow, operation.source, operation.source);
        const targetNode = this.findNode(workflow, operation.target, operation.target);
        if (!sourceNode || !targetNode) {
            return;
        }
        const sourceOutput = String(operation.sourceOutput ?? 'main');
        const connections = workflow.connections[sourceNode.name]?.[sourceOutput];
        if (!connections)
            return;
        workflow.connections[sourceNode.name][sourceOutput] = connections.map(conns => conns.filter(conn => conn.node !== targetNode.name));
        const outputConnections = workflow.connections[sourceNode.name][sourceOutput];
        while (outputConnections.length > 0 && outputConnections[outputConnections.length - 1].length === 0) {
            outputConnections.pop();
        }
        if (outputConnections.length === 0) {
            delete workflow.connections[sourceNode.name][sourceOutput];
        }
        if (Object.keys(workflow.connections[sourceNode.name]).length === 0) {
            delete workflow.connections[sourceNode.name];
        }
    }
    applyRewireConnection(workflow, operation) {
        const sourceNode = this.findNode(workflow, operation.source, operation.source);
        const fromNode = this.findNode(workflow, operation.from, operation.from);
        const toNode = this.findNode(workflow, operation.to, operation.to);
        if (!sourceNode || !fromNode || !toNode) {
            throw new Error(`rewireConnection: unresolved node reference(s). ` +
                `source=${JSON.stringify(operation.source)} (${sourceNode ? 'ok' : 'missing'}), ` +
                `from=${JSON.stringify(operation.from)} (${fromNode ? 'ok' : 'missing'}), ` +
                `to=${JSON.stringify(operation.to)} (${toNode ? 'ok' : 'missing'}). ` +
                `Available nodes: ${workflow.nodes.map(n => `"${n.name}" (${n.id})`).join(', ')}`);
        }
        if (fromNode.id === toNode.id) {
            throw new Error(`rewireConnection: "from" and "to" resolve to the same node "${fromNode.name}" (id: ${fromNode.id}). ` +
                `A rewire requires a distinct target.`);
        }
        const { sourceOutput, sourceIndex } = this.resolveSmartParameters(workflow, operation);
        const totalFromEdges = () => {
            const slots = workflow.connections[sourceNode.name]?.[sourceOutput] ?? [];
            return slots.reduce((acc, slot) => acc + (slot ?? []).filter(c => c.node === fromNode.name).length, 0);
        };
        const fromEdgesBefore = totalFromEdges();
        const toAlreadyPresent = (workflow.connections[sourceNode.name]?.[sourceOutput]?.[sourceIndex] ?? [])
            .some(c => c.node === toNode.name);
        this.applyRemoveConnection(workflow, {
            type: 'removeConnection',
            source: sourceNode.name,
            target: fromNode.name,
            sourceOutput: sourceOutput,
            targetInput: operation.targetInput
        });
        if (!toAlreadyPresent) {
            this.applyAddConnection(workflow, {
                type: 'addConnection',
                source: sourceNode.name,
                target: toNode.name,
                sourceOutput: sourceOutput,
                targetInput: operation.targetInput,
                sourceIndex: sourceIndex,
                targetIndex: 0
            });
        }
        const fromEdgesAfter = totalFromEdges();
        if (fromEdgesBefore > 0 && fromEdgesAfter !== 0) {
            throw new Error(`rewireConnection invariant violated: "${sourceNode.name}" → "${fromNode.name}" ` +
                `edges should have been removed (had ${fromEdgesBefore}, still have ${fromEdgesAfter}). ` +
                `Refusing to commit a corrupted connection map.`);
        }
    }
    applyUpdateSettings(workflow, operation) {
        if (operation.settings && Object.keys(operation.settings).length > 0) {
            if (!workflow.settings) {
                workflow.settings = {};
            }
            Object.assign(workflow.settings, operation.settings);
        }
    }
    applyUpdateName(workflow, operation) {
        workflow.name = operation.name;
    }
    validateSetNodeGroups(workflow, operation) {
        const groups = operation.nodeGroups;
        if (!Array.isArray(groups)) {
            return `setNodeGroups requires a "nodeGroups" array. Pass every group you want to keep, or [] to ungroup everything. Example: {type: "setNodeGroups", nodeGroups: [{name: "Enrich lead", nodeNames: ["Fetch company", "Score lead"]}]}`;
        }
        const seenNames = new Set();
        const claimedNodes = new Map();
        for (const group of groups) {
            if (!group || typeof group !== 'object') {
                return `setNodeGroups: every entry must be an object like {name: "Enrich lead", nodeNames: ["Fetch company", "Score lead"]}`;
            }
            const name = typeof group.name === 'string' ? group.name.trim() : '';
            if (!name) {
                return `setNodeGroups: every group needs a non-empty "name"`;
            }
            if (seenNames.has(name)) {
                return `setNodeGroups: duplicate group name "${name}". n8n requires group names to be unique.`;
            }
            seenNames.add(name);
            if (group.id !== undefined && (typeof group.id !== 'string' || !group.id.trim())) {
                return `setNodeGroups: group "${name}" has a non-string "id". Omit it to have one generated.`;
            }
            if (group.description !== undefined) {
                if (typeof group.description !== 'string') {
                    return `setNodeGroups: group "${name}" has a non-string "description"`;
                }
                if (group.description.trim().length > node_groups_1.GROUP_DESCRIPTION_MAX_LENGTH) {
                    return `setNodeGroups: group "${name}" has a description of ${group.description.trim().length} characters; n8n allows at most ${node_groups_1.GROUP_DESCRIPTION_MAX_LENGTH}.`;
                }
            }
            const hasNames = Array.isArray(group.nodeNames) && group.nodeNames.length > 0;
            const hasIds = Array.isArray(group.nodeIds) && group.nodeIds.length > 0;
            if (hasNames === hasIds) {
                return hasNames
                    ? `setNodeGroups: group "${name}" sets both "nodeNames" and "nodeIds" — use one or the other`
                    : `setNodeGroups: group "${name}" needs members in "nodeNames" (or "nodeIds")`;
            }
            const members = hasIds ? group.nodeIds : group.nodeNames;
            const badIndex = members.findIndex(member => typeof member !== 'string' || !member.trim());
            if (badIndex !== -1) {
                return `setNodeGroups: group "${name}" has a member that is not a node ${hasIds ? 'ID' : 'name'} (${JSON.stringify(members[badIndex])})`;
            }
            const resolvedMembers = this.resolveGroupMembers(workflow, group);
            if (typeof resolvedMembers === 'string')
                return resolvedMembers;
            for (const node of resolvedMembers) {
                const owner = claimedNodes.get(node.id);
                if (owner && owner !== name) {
                    return `setNodeGroups: node "${node.name}" is in both "${owner}" and "${name}" — a node can only belong to one group`;
                }
                claimedNodes.set(node.id, name);
            }
        }
        return null;
    }
    resolveGroupMembers(workflow, group) {
        const label = group.name?.trim() || group.id || 'unnamed group';
        const resolved = [];
        if (Array.isArray(group.nodeIds) && group.nodeIds.length > 0) {
            for (const nodeId of group.nodeIds) {
                const node = workflow.nodes.find(n => n.id === nodeId);
                if (!node) {
                    return `setNodeGroups: group "${label}" references node ID "${nodeId}", which is not in the workflow. ${this.formatNodeNotFoundError(workflow, nodeId, 'setNodeGroups')}`;
                }
                resolved.push(node);
            }
            return resolved;
        }
        for (const nodeName of group.nodeNames ?? []) {
            const normalized = this.normalizeNodeName(nodeName);
            const node = workflow.nodes.find(n => this.normalizeNodeName(n.name) === normalized);
            if (!node) {
                return `setNodeGroups: group "${label}" references node "${nodeName}", which is not in the workflow. ${this.formatNodeNotFoundError(workflow, nodeName, 'setNodeGroups')}`;
            }
            resolved.push(node);
        }
        return resolved;
    }
    applySetNodeGroups(workflow, operation) {
        const groups = [];
        for (const group of operation.nodeGroups) {
            const members = this.resolveGroupMembers(workflow, group);
            if (typeof members === 'string')
                throw new Error(members);
            const resolved = (0, node_groups_1.toWorkflowNodeGroup)({
                id: group.id,
                name: group.name,
                nodeIds: [...new Set(members.map(node => node.id))],
                description: group.description
            });
            groups.push(resolved);
            this.authoredGroupNames.add(resolved.name);
        }
        workflow.nodeGroups = groups;
    }
    authoredGroupNamesOrUndefined() {
        return this.authoredGroupNames.size > 0 ? [...this.authoredGroupNames] : undefined;
    }
    finalizeNodeGroups(workflow) {
        if (!Array.isArray(workflow.nodeGroups) || workflow.nodeGroups.length === 0)
            return;
        const { nodeGroups, issues } = (0, node_groups_1.repairNodeGroups)(workflow);
        workflow.nodeGroups = nodeGroups;
        for (const issue of issues) {
            this.warnings.push({ operation: -1, message: issue.message });
        }
    }
    applyAddTag(workflow, operation) {
        const removeIdx = this.tagsToRemove.indexOf(operation.tag);
        if (removeIdx !== -1) {
            this.tagsToRemove.splice(removeIdx, 1);
        }
        if (!this.tagsToAdd.includes(operation.tag)) {
            this.tagsToAdd.push(operation.tag);
        }
    }
    applyRemoveTag(workflow, operation) {
        const addIdx = this.tagsToAdd.indexOf(operation.tag);
        if (addIdx !== -1) {
            this.tagsToAdd.splice(addIdx, 1);
        }
        if (!this.tagsToRemove.includes(operation.tag)) {
            this.tagsToRemove.push(operation.tag);
        }
    }
    validateActivateWorkflow(workflow, operation) {
        const activatableTriggers = workflow.nodes.filter(node => !node.disabled && (0, node_type_utils_1.isActivatableTrigger)(node.type));
        if (activatableTriggers.length === 0) {
            return 'Cannot activate workflow: No activatable trigger nodes found. Workflows must have at least one enabled trigger node (webhook, schedule, executeWorkflowTrigger, etc.).';
        }
        return null;
    }
    validateDeactivateWorkflow(workflow, operation) {
        return null;
    }
    applyActivateWorkflow(workflow, operation) {
        workflow._shouldActivate = true;
        workflow._shouldDeactivate = false;
    }
    applyDeactivateWorkflow(workflow, operation) {
        workflow._shouldDeactivate = true;
        workflow._shouldActivate = false;
    }
    validateMoveToFolder(_workflow, operation) {
        const target = operation.parentFolderId;
        if (target !== null && (typeof target !== 'string' || target.trim().length === 0)) {
            return 'moveToFolder requires parentFolderId to be a non-empty folder ID string, or null for the project root';
        }
        return null;
    }
    applyMoveToFolder(workflow, operation) {
        const target = operation.parentFolderId;
        workflow.parentFolderId = target === null ? null : target.trim();
    }
    validateTransferWorkflow(_workflow, operation) {
        if (!operation.destinationProjectId) {
            return 'transferWorkflow requires a non-empty destinationProjectId string';
        }
        return null;
    }
    applyTransferWorkflow(_workflow, operation) {
        this.transferToProjectId = operation.destinationProjectId;
    }
    validateCleanStaleConnections(workflow, operation) {
        return null;
    }
    validateReplaceConnections(workflow, operation) {
        const nodeNames = new Set(workflow.nodes.map(n => n.name));
        for (const [sourceName, outputs] of Object.entries(operation.connections)) {
            if (!nodeNames.has(sourceName)) {
                return `Source node not found in connections: ${sourceName}`;
            }
            for (const outputName of Object.keys(outputs)) {
                const connections = outputs[outputName];
                for (const conns of connections) {
                    for (const conn of conns) {
                        if (!nodeNames.has(conn.node)) {
                            return `Target node not found in connections: ${conn.node}`;
                        }
                    }
                }
            }
        }
        return null;
    }
    applyCleanStaleConnections(workflow, operation) {
        const nodeNames = new Set(workflow.nodes.map(n => n.name));
        const staleConnections = [];
        if (operation.dryRun) {
            for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
                if (!nodeNames.has(sourceName)) {
                    for (const [outputName, connections] of Object.entries(outputs)) {
                        for (const conns of connections) {
                            for (const conn of conns) {
                                staleConnections.push({ from: sourceName, to: conn.node });
                            }
                        }
                    }
                }
                else {
                    for (const [outputName, connections] of Object.entries(outputs)) {
                        for (const conns of connections) {
                            for (const conn of conns) {
                                if (!nodeNames.has(conn.node)) {
                                    staleConnections.push({ from: sourceName, to: conn.node });
                                }
                            }
                        }
                    }
                }
            }
            logger.info(`[DryRun] Would remove ${staleConnections.length} stale connections:`, staleConnections);
            return;
        }
        for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
            if (!nodeNames.has(sourceName)) {
                for (const [outputName, connections] of Object.entries(outputs)) {
                    for (const conns of connections) {
                        for (const conn of conns) {
                            staleConnections.push({ from: sourceName, to: conn.node });
                        }
                    }
                }
                delete workflow.connections[sourceName];
                continue;
            }
            for (const [outputName, connections] of Object.entries(outputs)) {
                const filteredConnections = connections.map(conns => conns.filter(conn => {
                    if (!nodeNames.has(conn.node)) {
                        staleConnections.push({ from: sourceName, to: conn.node });
                        return false;
                    }
                    return true;
                }));
                while (filteredConnections.length > 0 && filteredConnections[filteredConnections.length - 1].length === 0) {
                    filteredConnections.pop();
                }
                if (filteredConnections.length === 0) {
                    delete outputs[outputName];
                }
                else {
                    outputs[outputName] = filteredConnections;
                }
            }
            if (Object.keys(outputs).length === 0) {
                delete workflow.connections[sourceName];
            }
        }
        logger.info(`Removed ${staleConnections.length} stale connections`);
    }
    applyReplaceConnections(workflow, operation) {
        workflow.connections = operation.connections;
    }
    flushPendingRenames(workflow) {
        if (this.renameMap.size === 0)
            return;
        this.updateConnectionReferences(workflow);
        logger.debug(`Auto-updated ${this.renameMap.size} node name references in connections`);
        this.renameMap.clear();
    }
    updateConnectionReferences(workflow) {
        if (this.renameMap.size === 0)
            return;
        logger.debug(`Updating connection references for ${this.renameMap.size} renamed nodes`);
        const renames = new Map(this.renameMap);
        const updatedConnections = {};
        for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
            const newSourceName = renames.get(sourceName) || sourceName;
            updatedConnections[newSourceName] = outputs;
        }
        for (const [sourceName, outputs] of Object.entries(updatedConnections)) {
            for (const [outputType, connections] of Object.entries(outputs)) {
                for (let outputIndex = 0; outputIndex < connections.length; outputIndex++) {
                    const connectionsAtIndex = connections[outputIndex];
                    for (let connIndex = 0; connIndex < connectionsAtIndex.length; connIndex++) {
                        const connection = connectionsAtIndex[connIndex];
                        if (renames.has(connection.node)) {
                            const oldTargetName = connection.node;
                            const newTargetName = renames.get(connection.node);
                            connection.node = newTargetName;
                            logger.debug(`Updated connection: ${sourceName}[${outputType}][${outputIndex}][${connIndex}].node: "${oldTargetName}" → "${newTargetName}"`);
                        }
                    }
                }
            }
        }
        workflow.connections = updatedConnections;
        logger.info(`Auto-updated ${this.renameMap.size} node name references in connections`);
    }
    normalizeNodeName(name) {
        return name
            .trim()
            .replace(/\\([\\'"])/g, '$1')
            .replace(/\s+/g, ' ');
    }
    findNode(workflow, nodeId, nodeName) {
        if (nodeId) {
            const nodeById = workflow.nodes.find(n => n.id === nodeId);
            if (nodeById)
                return nodeById;
        }
        if (nodeName) {
            const normalizedSearch = this.normalizeNodeName(nodeName);
            const nodeByName = workflow.nodes.find(n => this.normalizeNodeName(n.name) === normalizedSearch);
            if (nodeByName)
                return nodeByName;
        }
        if (nodeId && !nodeName) {
            const normalizedSearch = this.normalizeNodeName(nodeId);
            const nodeByName = workflow.nodes.find(n => this.normalizeNodeName(n.name) === normalizedSearch);
            if (nodeByName)
                return nodeByName;
        }
        return null;
    }
    formatNodeNotFoundError(workflow, nodeIdentifier, operationType) {
        const availableNodes = workflow.nodes
            .map(n => `"${n.name}" (id: ${n.id.substring(0, 8)}...)`)
            .join(', ');
        return `Node not found for ${operationType}: "${nodeIdentifier}". Available nodes: ${availableNodes}. Tip: Use node ID for names with special characters (apostrophes, quotes).`;
    }
    getNestedProperty(obj, path) {
        let current = obj;
        try {
            for (const segment of parsePropertyPath(path)) {
                if (DANGEROUS_PATH_KEYS.has(segment.key))
                    return undefined;
                if (current == null || typeof current !== 'object')
                    return undefined;
                const key = resolveSegment(current, segment, path, false);
                current = current[key];
            }
        }
        catch {
            return undefined;
        }
        return current;
    }
    setNestedProperty(obj, path, value) {
        const segments = parsePropertyPath(path);
        let current = obj;
        if (segments.some(s => DANGEROUS_PATH_KEYS.has(s.key))) {
            throw new Error(`Invalid property path: "${path}" contains a forbidden key`);
        }
        for (let i = 0; i < segments.length - 1; i++) {
            const key = resolveSegment(current, segments[i], path, true);
            if (typeof key === 'string' && DANGEROUS_PATH_KEYS.has(key)) {
                throw new Error(`Invalid property path: "${path}" contains a forbidden key`);
            }
            if (!Object.prototype.hasOwnProperty.call(current, key)
                || typeof current[key] !== 'object'
                || current[key] === null) {
                if (value === null || value === undefined)
                    return;
                current[key] = {};
            }
            current = current[key];
        }
        const finalKey = resolveSegment(current, segments[segments.length - 1], path, true);
        if (typeof finalKey === 'string' && DANGEROUS_PATH_KEYS.has(finalKey)) {
            throw new Error(`Invalid property path: "${path}" contains a forbidden key`);
        }
        if (value === null || value === undefined) {
            if (typeof finalKey === 'number') {
                current.splice(finalKey, 1);
            }
            else {
                delete current[finalKey];
            }
        }
        else {
            current[finalKey] = value;
        }
    }
}
exports.WorkflowDiffEngine = WorkflowDiffEngine;
//# sourceMappingURL=workflow-diff-engine.js.map