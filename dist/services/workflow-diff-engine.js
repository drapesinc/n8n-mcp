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
exports.WorkflowDiffEngine = exports.MAX_CONNECTION_INDEX = void 0;
const uuid_1 = require("uuid");
const vm = __importStar(require("vm"));
const workflow_diff_1 = require("../types/workflow-diff");
const logger_1 = require("../utils/logger");
const object_keys_1 = require("../utils/object-keys");
const node_groups_1 = require("./node-groups");
const node_sanitizer_1 = require("./node-sanitizer");
const node_type_utils_1 = require("../utils/node-type-utils");
const logger = new logger_1.Logger({ prefix: '[WorkflowDiffEngine]' });
const PATCH_LIMITS = {
    MAX_PATCHES: 50,
    MAX_REGEX_LENGTH: 500,
    MAX_FIELD_SIZE_REGEX: 512 * 1024,
    REGEX_EVAL_TIMEOUT_MS: 100,
    REGEX_TIME_BUDGET_MS: 300,
    MAX_PATCH_GROWTH: 512 * 1024,
};
const MAX_DIFF_OPERATIONS = 1000;
exports.MAX_CONNECTION_INDEX = 1000;
const DANGEROUS_PATH_KEYS = object_keys_1.RESERVED_OBJECT_KEYS;
function ownOutputs(connections, nodeName) {
    return (0, object_keys_1.hasOwnKey)(connections, nodeName) ? connections[nodeName] : undefined;
}
function ownOutputSlots(connections, nodeName, output) {
    const outputs = ownOutputs(connections, nodeName);
    return outputs && (0, object_keys_1.hasOwnKey)(outputs, output) ? outputs[output] : undefined;
}
function isUnsafeRegex(pattern) {
    const groups = [];
    let closedGroupIsComplex = false;
    let i = 0;
    const markEnclosingGroup = () => {
        if (groups.length > 0)
            groups[groups.length - 1] = true;
    };
    while (i < pattern.length) {
        const ch = pattern[i];
        const afterGroup = closedGroupIsComplex;
        closedGroupIsComplex = false;
        if (ch === '\\') {
            i += 2;
            continue;
        }
        if (ch === '[') {
            i++;
            if (pattern[i] === '^')
                i++;
            while (i < pattern.length && pattern[i] !== ']') {
                i += pattern[i] === '\\' ? 2 : 1;
            }
            i++;
            continue;
        }
        if (ch === '(') {
            groups.push(false);
            i++;
            if (pattern[i] === '?') {
                const prefix = /^\?(?:<[A-Za-z_$][\w$]*>|<=|<!|[:=!])/.exec(pattern.slice(i, i + 64));
                i += prefix ? prefix[0].length : 1;
            }
            continue;
        }
        if (ch === ')') {
            const complex = groups.pop() ?? false;
            if (complex)
                markEnclosingGroup();
            closedGroupIsComplex = complex;
            i++;
            continue;
        }
        let quantifierLength = 0;
        let unbounded = false;
        if (ch === '*' || ch === '+') {
            quantifierLength = 1;
            unbounded = true;
        }
        else if (ch === '?') {
            quantifierLength = 1;
        }
        else if (ch === '{') {
            const braces = /^\{\d+(,(\d*))?\}/.exec(pattern.slice(i, i + 32));
            if (braces) {
                quantifierLength = braces[0].length;
                unbounded = braces[2] === '';
            }
        }
        if (quantifierLength > 0) {
            if (unbounded) {
                if (afterGroup)
                    return true;
                markEnclosingGroup();
            }
            i += quantifierLength;
            if (pattern[i] === '?')
                i++;
            continue;
        }
        i++;
    }
    return false;
}
const regexContext = vm.createContext(Object.create(null));
const regexPatchScript = new vm.Script(`(function (input, pattern, replacement, replaceAll, maxLength) {
  var re = new RegExp(pattern, 'g');
  var len = input.length;
  var count = 0;
  var tooLarge = false;
  var tokens = null;
  var delta = 0;
  var m;

  function parseTemplate(groupCount, hasNamedGroups) {
    var refs = [];
    var literal = 0;
    var i = 0;
    while (i < replacement.length) {
      if (replacement[i] !== '$' || i + 1 >= replacement.length) { literal++; i++; continue; }
      var next = replacement[i + 1];
      if (next === '$') { literal++; i += 2; continue; }
      if (next === '&') { refs.push(0); i += 2; continue; }
      if (next.charCodeAt(0) === 96) { refs.push(-1); i += 2; continue; }
      if (next === "'") { refs.push(-2); i += 2; continue; }
      if (next >= '0' && next <= '9') {
        var one = next.charCodeAt(0) - 48;
        var third = replacement[i + 2];
        if (third >= '0' && third <= '9') {
          var two = one * 10 + third.charCodeAt(0) - 48;
          if (two >= 1 && two <= groupCount) { refs.push(two); i += 3; continue; }
        }
        if (one >= 1 && one <= groupCount) { refs.push(one); i += 2; continue; }
        literal++; i++; continue;
      }
      if (next === '<' && hasNamedGroups) {
        var close = replacement.indexOf('>', i + 2);
        if (close !== -1) { refs.push(replacement.slice(i + 2, close)); i = close + 1; continue; }
      }
      literal++; i++;
    }
    return { refs: refs, literal: literal };
  }

  function substitutionLength(match) {
    var total = tokens.literal;
    for (var k = 0; k < tokens.refs.length; k++) {
      var ref = tokens.refs[k];
      var part;
      if (ref === 0) part = match[0];
      else if (ref === -1) { total += match.index; continue; }
      else if (ref === -2) { total += len - match.index - match[0].length; continue; }
      else if (typeof ref === 'number') part = match[ref];
      else part = match.groups[ref];
      if (part !== undefined) total += part.length;
    }
    return total;
  }

  while ((m = re.exec(input)) !== null) {
    count++;
    if (m[0].length === 0) re.lastIndex++;
    if (count === 1) tokens = parseTemplate(m.length - 1, m.groups !== undefined);
    if (count === 1 || replaceAll) {
      delta += substitutionLength(m) - m[0].length;
      if (replaceAll && len + delta > maxLength) { tooLarge = true; break; }
    }
  }
  if (count > 0 && len + delta > maxLength) tooLarge = true;
  var output = null;
  if (!tooLarge && (count === 1 || (count > 1 && replaceAll))) {
    output = input.replace(replaceAll ? new RegExp(pattern, 'g') : new RegExp(pattern), replacement);
  }
  result = { count: count, tooLarge: tooLarge, output: output };
})(input, pattern, replacement, replaceAll, maxLength);`);
function runRegexPatch(input, pattern, replacement, replaceAll, timeoutMs, maxLength) {
    const ctx = regexContext;
    Object.assign(ctx, { input, pattern, replacement, replaceAll, maxLength, result: null });
    try {
        regexPatchScript.runInContext(regexContext, { timeout: Math.max(1, Math.ceil(timeoutMs)) });
        const result = ctx.result;
        return { count: result.count, output: result.output, tooLarge: result.tooLarge === true };
    }
    catch (error) {
        if (error?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT')
            return 'timeout';
        throw new Error(String(error?.message ?? error));
    }
    finally {
        Object.assign(ctx, { input: null, pattern: null, replacement: null, result: null });
    }
}
function connectionIndexError(name, index) {
    if (index === undefined)
        return null;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > exports.MAX_CONNECTION_INDEX) {
        return `${name} ${String(index).slice(0, 40)} is out of range. Connection indexes must be integers between 0 and ${exports.MAX_CONNECTION_INDEX}.`;
    }
    return null;
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
function describeValueType(value) {
    if (value === null)
        return 'null';
    if (value === undefined)
        return 'nothing';
    if (Array.isArray(value))
        return 'an array';
    return typeof value === 'object' ? 'an object' : `a ${typeof value}`;
}
function branchConnections(branch) {
    return Array.isArray(branch) ? branch : [];
}
function filterBranch(branch, keep) {
    return Array.isArray(branch) ? branch.filter(keep) : branch;
}
function trimTrailingEmptyBranches(branches) {
    while (branches.length > 0 && branchConnections(branches[branches.length - 1]).length === 0) {
        branches.pop();
    }
}
function validateAddNodeShape(node) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) {
        return `addNode requires a node object, received ${describeValueType(node)}`;
    }
    const candidate = node;
    if (typeof candidate.name !== 'string') {
        return `addNode requires a string "name" on the node, received ${describeValueType(candidate.name)}`;
    }
    if (typeof candidate.type !== 'string') {
        return `addNode requires a string "type" on the node, received ${describeValueType(candidate.type)}`;
    }
    return null;
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
    if (!addedNode || typeof addedNode !== 'object') {
        return false;
    }
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
        this.regexBudgetMs = PATCH_LIMITS.REGEX_TIME_BUDGET_MS;
        this.patchGrowthBudget = PATCH_LIMITS.MAX_PATCH_GROWTH;
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
            this.regexBudgetMs = PATCH_LIMITS.REGEX_TIME_BUDGET_MS;
            this.patchGrowthBudget = PATCH_LIMITS.MAX_PATCH_GROWTH;
            if (Array.isArray(request.operations) && request.operations.length > MAX_DIFF_OPERATIONS) {
                return {
                    success: false,
                    errors: [{
                            operation: -1,
                            message: `Too many operations (${request.operations.length}). Maximum is ${MAX_DIFF_OPERATIONS} per request; split the changes across requests.`
                        }]
                };
            }
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
        const reservedKeyError = this.validateReservedKeys(workflow, operation);
        if (reservedKeyError) {
            return reservedKeyError;
        }
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
    validateReservedKeys(workflow, operation) {
        const reservedNodeName = (name) => (0, object_keys_1.isReservedObjectKey)(name) ? `Node name "${name}" is reserved and cannot be used` : null;
        const reservedConnectionKey = (key) => (0, object_keys_1.isReservedObjectKey)(key) ? `Connection type "${String(key)}" is reserved and cannot be used` : null;
        const resolvedName = (ref) => typeof ref === 'string' ? this.findNode(workflow, ref, ref)?.name : undefined;
        switch (operation.type) {
            case 'addNode':
                return reservedNodeName(operation.node?.name);
            case 'updateNode': {
                const updates = operation.updates;
                return updates && typeof updates === 'object' ? reservedNodeName(updates.name) : null;
            }
            case 'addConnection':
            case 'removeConnection':
            case 'rewireConnection': {
                const op = operation;
                for (const ref of [op.source, op.target, op.from, op.to]) {
                    const error = reservedNodeName(resolvedName(ref));
                    if (error)
                        return error;
                }
                return reservedConnectionKey(op.sourceOutput) ?? reservedConnectionKey(op.targetInput);
            }
            case 'updateSettings': {
                const settings = operation.settings;
                if (!settings || typeof settings !== 'object')
                    return null;
                const reservedKey = Object.keys(settings).find(key => (0, object_keys_1.isReservedObjectKey)(key));
                return reservedKey !== undefined ? `Setting "${reservedKey}" is reserved and cannot be used` : null;
            }
            case 'replaceConnections': {
                const connections = operation.connections;
                if (!connections || typeof connections !== 'object')
                    return null;
                for (const sourceName of Object.keys(connections)) {
                    const error = reservedNodeName(sourceName);
                    if (error)
                        return error;
                    const outputs = connections[sourceName];
                    if (outputs && typeof outputs === 'object') {
                        for (const outputName of Object.keys(outputs)) {
                            const outputError = reservedConnectionKey(outputName);
                            if (outputError)
                                return outputError;
                        }
                    }
                }
                return null;
            }
            default:
                return null;
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
        const shapeError = validateAddNodeShape(node);
        if (shapeError) {
            return shapeError;
        }
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
            return Object.values(conn).some(outputs => outputs.some(connections => branchConnections(connections).some(c => c.node === node.name)));
        });
        if (hasConnections || ownOutputs(workflow.connections, node.name)) {
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
        if (typeof operation.updates !== 'object' || Array.isArray(operation.updates)) {
            return `The updateNode operation requires 'updates' to be an object of field paths, received ${describeValueType(operation.updates)}. Example: {type: "updateNode", nodeName: "My Node", updates: {"parameters.url": "https://example.com"}}`;
        }
        const node = this.findNode(workflow, operation.nodeId, operation.nodeName);
        if (!node) {
            return this.formatNodeNotFoundError(workflow, operation.nodeId || operation.nodeName || '', 'updateNode');
        }
        if ('id' in operation.updates && operation.updates.id !== node.id) {
            return `Cannot change the id of node "${node.name}": node IDs are immutable because canvas groups and pinned data reference them. Remove and re-add the node instead.`;
        }
        if ('name' in operation.updates && typeof operation.updates.name !== 'string') {
            return `Cannot rename node "${node.name}": 'updates.name' must be a string, received ${describeValueType(operation.updates.name)}.`;
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
        const indexError = connectionIndexError('sourceIndex', sourceIndex) ?? connectionIndexError('targetIndex', operation.targetIndex);
        if (indexError)
            return indexError;
        const existing = ownOutputSlots(workflow.connections, sourceNode.name, sourceOutput);
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
        const connections = ownOutputSlots(workflow.connections, sourceNode.name, String(sourceOutput));
        if (!connections) {
            return `No connections found from "${sourceNode.name}"`;
        }
        const hasConnection = connections.some(conns => branchConnections(conns).some(c => c.node === targetNode.name));
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
        const indexError = connectionIndexError('sourceIndex', sourceIndex);
        if (indexError)
            return indexError;
        const connections = ownOutputSlots(workflow.connections, sourceNode.name, sourceOutput);
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
                sourceConnections[outputName] = outputConns.map(branch => filterBranch(branch, conn => conn.node !== node.name));
                const trimmed = sourceConnections[outputName];
                trimTrailingEmptyBranches(trimmed);
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
        const replacementLength = operation.patches.reduce((sum, p) => sum + p.replace.length, 0);
        const maxLength = original.length + replacementLength + this.patchGrowthBudget;
        const tooLargeError = (i) => new Error(`patchNodeField: patch index ${i} would grow "${operation.fieldPath}" beyond ${Math.round(maxLength / 1024)}KB ` +
            `(patches in one request may add at most ${PATCH_LIMITS.MAX_PATCH_GROWTH / 1024}KB beyond their replacement text). ` +
            `Use updateNode to set a large value directly.`);
        for (let i = 0; i < operation.patches.length; i++) {
            const patch = operation.patches[i];
            if (patch.regex) {
                if (current.length > PATCH_LIMITS.MAX_FIELD_SIZE_REGEX) {
                    throw new Error(`Field "${operation.fieldPath}" is too large for regex operations (${Math.round(current.length / 1024)}KB) at patch index ${i}. ` +
                        `Maximum is ${PATCH_LIMITS.MAX_FIELD_SIZE_REGEX / 1024}KB. Use literal matching (regex: false) for large fields.`);
                }
                if (this.regexBudgetMs <= 0) {
                    throw new Error(`patchNodeField: regex time limit for this request is used up (patch index ${i}). ` +
                        `Use literal matching (regex: false) or split the changes across requests.`);
                }
                const timeoutMs = Math.min(PATCH_LIMITS.REGEX_EVAL_TIMEOUT_MS, this.regexBudgetMs);
                const startedAt = performance.now();
                const result = runRegexPatch(current, patch.find, patch.replace, patch.replaceAll === true, timeoutMs, maxLength);
                this.regexBudgetMs -= performance.now() - startedAt;
                if (result === 'timeout') {
                    throw new Error(`patchNodeField: regex pattern at patch index ${i} took too long to evaluate on "${operation.fieldPath}". ` +
                        `Simplify the pattern or use literal matching (regex: false).`);
                }
                if (result.count === 0) {
                    throw new Error(`patchNodeField: regex pattern "${patch.find}" not found in "${operation.fieldPath}" (patch index ${i}). ` +
                        `Use n8n_get_workflow to inspect the current value.`);
                }
                if (result.count > 1 && !patch.replaceAll) {
                    throw new Error(`patchNodeField: regex pattern "${patch.find}" matches ${result.count} times in "${operation.fieldPath}" (patch index ${i}). ` +
                        `Set "replaceAll": true to replace all occurrences, or refine the pattern to match exactly once.`);
                }
                if (result.tooLarge)
                    throw tooLargeError(i);
                current = result.output;
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
                if (current.length + occurrences * (patch.replace.length - patch.find.length) > maxLength) {
                    throw tooLargeError(i);
                }
                current = current.split(patch.find).join(patch.replace);
            }
        }
        assertPatchedJsSyntax('patchNodeField', operation.fieldPath, current, original);
        this.setNestedProperty(node, operation.fieldPath, current);
        this.patchGrowthBudget -= Math.max(0, current.length - original.length - replacementLength);
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
        if (!Number.isInteger(sourceIndex) || sourceIndex < 0) {
            throw new Error(`sourceIndex must be a non-negative integer, received ${JSON.stringify(sourceIndex)}`);
        }
        const indexError = connectionIndexError('sourceIndex', sourceIndex) ?? connectionIndexError('targetIndex', targetIndex);
        if (indexError)
            throw new Error(indexError);
        let nodeOutputs = ownOutputs(workflow.connections, sourceNode.name);
        if (!nodeOutputs) {
            nodeOutputs = {};
            workflow.connections[sourceNode.name] = nodeOutputs;
        }
        let outputArray = ownOutputSlots(workflow.connections, sourceNode.name, sourceOutput);
        if (!outputArray) {
            outputArray = [];
            nodeOutputs[sourceOutput] = outputArray;
        }
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
        const nodeOutputs = ownOutputs(workflow.connections, sourceNode.name);
        const connections = ownOutputSlots(workflow.connections, sourceNode.name, sourceOutput);
        if (!nodeOutputs || !connections)
            return;
        const outputConnections = connections.map(branch => filterBranch(branch, conn => conn.node !== targetNode.name));
        nodeOutputs[sourceOutput] = outputConnections;
        trimTrailingEmptyBranches(outputConnections);
        if (outputConnections.length === 0) {
            delete nodeOutputs[sourceOutput];
        }
        if (Object.keys(nodeOutputs).length === 0) {
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
            const slots = ownOutputSlots(workflow.connections, sourceNode.name, sourceOutput) ?? [];
            return slots.reduce((acc, slot) => acc + (slot ?? []).filter(c => c.node === fromNode.name).length, 0);
        };
        const fromEdgesBefore = totalFromEdges();
        const toAlreadyPresent = (ownOutputSlots(workflow.connections, sourceNode.name, sourceOutput)?.[sourceIndex] ?? [])
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
        if (!operation.connections || typeof operation.connections !== 'object' || Array.isArray(operation.connections)) {
            return `The replaceConnections operation requires a 'connections' object, received ${describeValueType(operation.connections)}`;
        }
        const nodeNames = new Set(workflow.nodes.map(n => n.name));
        for (const [sourceName, outputs] of Object.entries(operation.connections)) {
            if (!nodeNames.has(sourceName)) {
                return `Source node not found in connections: ${sourceName}`;
            }
            if (!outputs || typeof outputs !== 'object' || Array.isArray(outputs)) {
                return `Connections for "${sourceName}" must be an object keyed by output name, received ${describeValueType(outputs)}`;
            }
            for (const outputName of Object.keys(outputs)) {
                const connections = outputs[outputName];
                if (!Array.isArray(connections)) {
                    return `Connections for "${sourceName}" output "${outputName}" must be an array of output arrays, received ${describeValueType(connections)}`;
                }
                if (connections.length > exports.MAX_CONNECTION_INDEX + 1) {
                    return `Connections for "${sourceName}" output "${outputName}" have ${connections.length} outputs. Maximum is ${exports.MAX_CONNECTION_INDEX + 1}.`;
                }
                for (const conns of connections) {
                    if (conns === null)
                        continue;
                    if (!Array.isArray(conns)) {
                        return `Connections for "${sourceName}" output "${outputName}" must contain arrays of connections, received ${describeValueType(conns)}`;
                    }
                    for (const conn of conns) {
                        if (!conn || typeof conn !== 'object' || typeof conn.node !== 'string') {
                            return `Each connection from "${sourceName}" output "${outputName}" must be an object with a string "node", received ${describeValueType(conn)}`;
                        }
                        if (!nodeNames.has(conn.node)) {
                            return `Target node not found in connections: ${conn.node}`;
                        }
                        const indexError = connectionIndexError(`Connection index from "${sourceName}" output "${outputName}"`, conn.index);
                        if (indexError)
                            return indexError;
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
                            for (const conn of branchConnections(conns)) {
                                staleConnections.push({ from: sourceName, to: conn.node });
                            }
                        }
                    }
                }
                else {
                    for (const [outputName, connections] of Object.entries(outputs)) {
                        for (const conns of connections) {
                            for (const conn of branchConnections(conns)) {
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
                        for (const conn of branchConnections(conns)) {
                            staleConnections.push({ from: sourceName, to: conn.node });
                        }
                    }
                }
                delete workflow.connections[sourceName];
                continue;
            }
            for (const [outputName, connections] of Object.entries(outputs)) {
                const filteredConnections = connections.map(branch => filterBranch(branch, conn => {
                    if (!nodeNames.has(conn.node)) {
                        staleConnections.push({ from: sourceName, to: conn.node });
                        return false;
                    }
                    return true;
                }));
                trimTrailingEmptyBranches(filteredConnections);
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
        const updatedConnections = Object.fromEntries(Object.entries(workflow.connections).map(([sourceName, outputs]) => [renames.get(sourceName) || sourceName, outputs]));
        for (const [sourceName, outputs] of Object.entries(updatedConnections)) {
            for (const [outputType, connections] of Object.entries(outputs)) {
                for (let outputIndex = 0; outputIndex < connections.length; outputIndex++) {
                    const connectionsAtIndex = branchConnections(connections[outputIndex]);
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