"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_CODE_CHARS = exports.MAX_CODE_LINES = void 0;
exports.findNativeAlternative = findNativeAlternative;
const acorn_1 = require("acorn");
const ALTERNATIVES = {
    editFields: { node: 'Edit Fields (Set)', nodeType: 'n8n-nodes-base.set', does: 'builds or renames fields' },
    filter: { node: 'Filter', nodeType: 'n8n-nodes-base.filter', does: 'filters items' },
    sort: { node: 'Sort', nodeType: 'n8n-nodes-base.sort', does: 'sorts items by a field', when: 'the field holds numbers' },
    removeDuplicates: { node: 'Remove Duplicates', nodeType: 'n8n-nodes-base.removeDuplicates', does: 'removes duplicate items', when: 'the compared fields hold text or numbers' },
    summarize: { node: 'Summarize', nodeType: 'n8n-nodes-base.summarize', does: 'totals a field over the items', when: 'the field holds numbers' },
    aggregate: { node: 'Aggregate', nodeType: 'n8n-nodes-base.aggregate', does: 'collects item values into one list' },
    splitOut: { node: 'Split Out', nodeType: 'n8n-nodes-base.splitOut', does: 'turns a list field into separate items' },
    httpRequest: { node: 'HTTP Request', nodeType: 'n8n-nodes-base.httpRequest', does: 'makes an HTTP request' },
};
exports.MAX_CODE_LINES = 20;
exports.MAX_CODE_CHARS = 5000;
const CALLBACK_METHODS = new Set(['map', 'filter', 'sort', 'reduce', 'find', 'some', 'every', 'flatMap', 'findIndex']);
const ALLOWED_FUNCTIONS = new Set([
    '$', '$items', 'String', 'Number', 'Boolean', 'parseInt', 'parseFloat',
    'encodeURIComponent', 'decodeURIComponent', 'encodeURI'
]);
const ALLOWED_METHODS = new Set([
    'first', 'last', 'all',
    ...CALLBACK_METHODS, 'join', 'slice', 'flat', 'includes', 'indexOf',
    'trim', 'trimStart', 'trimEnd', 'toLowerCase', 'toUpperCase', 'substring', 'substr',
    'padStart', 'padEnd', 'startsWith', 'endsWith', 'charAt', 'lastIndexOf', 'toString', 'fromCharCode', 'localeCompare',
    'toFixed', 'toLocaleString', 'floor', 'ceil', 'round', 'abs', 'min', 'max', 'random',
    'now', 'getTime', 'toISOString', 'toLocaleDateString', 'toLocaleTimeString', 'getFullYear', 'getMonth',
    'getDate', 'getDay', 'getHours', 'getMinutes', 'toISO', 'toFormat', 'toMillis', 'plus', 'minus',
    'startOf', 'endOf', 'setZone',
    'stringify',
    'httpRequest'
]);
const DISQUALIFYING_IDENTIFIERS = new Set([
    'require', 'Buffer', 'crypto', 'process', 'eval', 'Function', 'fetch', 'setTimeout', 'setInterval',
    '$getWorkflowStaticData', '$evaluateExpression', 'Promise', 'RegExp', 'Array', 'globalThis', 'arguments'
]);
const DISQUALIFYING_NODE_TYPES = new Set([
    'ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement',
    'TryStatement', 'ThrowStatement', 'SwitchStatement', 'IfStatement', 'LabeledStatement', 'WithStatement',
    'FunctionDeclaration', 'FunctionExpression', 'ClassDeclaration', 'ClassExpression', 'YieldExpression',
    'UpdateExpression', 'ImportExpression', 'SequenceExpression', 'TaggedTemplateExpression'
]);
const ALLOWED_CONSTRUCTORS = new Set(['Date']);
const COMPUTED_INITIALIZERS = new Set(['BinaryExpression', 'ConditionalExpression', 'LogicalExpression', 'CallExpression', 'NewExpression']);
const CALLBACK_GLOBALS = new Set(['Date', 'Number', 'String', 'Boolean', 'Math', 'undefined', 'NaN', 'Infinity']);
const CONDITION_FUNCTIONS = new Set(['Number', 'String', 'Boolean']);
const CONDITION_METHODS = new Set([
    'toLowerCase', 'toUpperCase', 'trim', 'includes', 'startsWith', 'endsWith', 'localeCompare', 'getTime'
]);
function walk(node, visit, parent) {
    visit(node, parent);
    for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) {
            for (const child of value)
                if (child && typeof child.type === 'string')
                    walk(child, visit, node);
        }
        else if (value && typeof value === 'object' && typeof value.type === 'string') {
            walk(value, visit, node);
        }
    }
}
function propertyName(member) {
    if (member.type !== 'MemberExpression')
        return undefined;
    if (!member.computed && member.property.type === 'Identifier')
        return member.property.name;
    if (member.property.type === 'Literal' && typeof member.property.value === 'string')
        return member.property.value;
    return undefined;
}
function keyName(property) {
    if (property.type !== 'Property')
        return undefined;
    return property.key?.name ?? property.key?.value;
}
function isIdentifier(node, name) {
    return node?.type === 'Identifier' && node.name === name;
}
function isPropertyName(node, parent) {
    if (parent?.type === 'MemberExpression')
        return parent.property === node && !parent.computed;
    if (parent?.type === 'Property')
        return parent.key === node && !parent.computed;
    return false;
}
function isHelpers(node) {
    return propertyName(node) === 'helpers' || isIdentifier(node, '$helpers');
}
function isHttpRequestCall(node) {
    return node.type === 'CallExpression' && propertyName(node.callee) === 'httpRequest' && isHelpers(node.callee.object);
}
function rootOf(node) {
    let base = node;
    while (base && (base.type === 'MemberExpression' || base.type === 'CallExpression')) {
        base = base.type === 'MemberExpression' ? base.object : base.callee;
    }
    return base;
}
function isItemsSource(node) {
    if (isIdentifier(node, 'items'))
        return true;
    return node?.type === 'CallExpression' && propertyName(node.callee) === 'all' && isIdentifier(node.callee.object, '$input');
}
function callbackResult(callback) {
    return callback.body.type === 'BlockStatement' ? callback.body.body[0]?.argument : callback.body;
}
function findNativeAlternative(jsCode, mode = 'runOnceForAllItems') {
    const knownMode = mode === undefined || mode === null ? 'runOnceForAllItems' : mode;
    if (knownMode !== 'runOnceForAllItems' && knownMode !== 'runOnceForEachItem')
        return undefined;
    try {
        return analyze(jsCode, knownMode);
    }
    catch {
        return undefined;
    }
}
function analyze(jsCode, mode) {
    if (typeof jsCode !== 'string' || jsCode.trim() === '' || jsCode.length > exports.MAX_CODE_CHARS)
        return undefined;
    const codeLines = new Set();
    const program = (0, acorn_1.parse)(jsCode, {
        ecmaVersion: 'latest',
        sourceType: 'script',
        allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
        locations: true,
        onToken: (token) => {
            if (token.type.label === 'eof' || !token.loc)
                return;
            for (let line = token.loc.start.line; line <= token.loc.end.line; line++)
                codeLines.add(line);
        }
    });
    if (codeLines.size > exports.MAX_CODE_LINES)
        return undefined;
    const perItem = mode === 'runOnceForEachItem';
    let disqualified = false;
    const inits = new Map();
    const returns = [];
    const methods = new Map();
    let httpCalls = 0;
    let assignsItemField = false;
    walk(program, (node, parent) => {
        if (disqualified)
            return;
        if (DISQUALIFYING_NODE_TYPES.has(node.type)) {
            disqualified = true;
            return;
        }
        switch (node.type) {
            case 'Literal':
                if (node.regex)
                    disqualified = true;
                break;
            case 'ThisExpression':
                if (!(parent?.type === 'MemberExpression' && propertyName(parent) === 'helpers'))
                    disqualified = true;
                break;
            case 'UnaryExpression':
                if (node.operator === 'delete')
                    disqualified = true;
                break;
            case 'ConditionalExpression':
                if ([node.consequent, node.alternate].some((branch) => branch.type === 'ConditionalExpression' || branch.type === 'ArrayExpression')) {
                    disqualified = true;
                }
                break;
            case 'Property':
                if ((node.computed && node.key.type !== 'Literal') || node.kind !== 'init' || node.method)
                    disqualified = true;
                break;
            case 'MemberExpression':
                if (propertyName(node) === 'binary')
                    disqualified = true;
                if (node.computed && node.property.type !== 'Literal' && !isIndexArithmetic(node.property))
                    disqualified = true;
                break;
            case 'SpreadElement':
                if (!isCurrentItemJson(node.argument))
                    disqualified = true;
                break;
            case 'Identifier':
                if (DISQUALIFYING_IDENTIFIERS.has(node.name))
                    disqualified = true;
                if (node.name === '$input' && !isPropertyName(node, parent) && !(parent?.type === 'MemberExpression' && parent.object === node)) {
                    disqualified = true;
                }
                break;
            case 'ReturnStatement':
                returns.push(node);
                break;
            case 'VariableDeclarator':
                if (node.id.type === 'Identifier' && node.init && !isReservedName(node.id.name) && !inits.has(node.id.name)) {
                    inits.set(node.id.name, node.init);
                }
                else {
                    disqualified = true;
                }
                break;
            case 'ExpressionStatement':
                if (node.expression.type !== 'AssignmentExpression')
                    disqualified = true;
                break;
            case 'AssignmentExpression':
                if (perItem && node.operator === '=' && isCurrentItemField(node.left))
                    assignsItemField = true;
                else
                    disqualified = true;
                break;
            case 'NewExpression':
                if (node.callee.type !== 'Identifier' || !ALLOWED_CONSTRUCTORS.has(node.callee.name))
                    disqualified = true;
                break;
            case 'AwaitExpression':
                if (!isHttpRequestCall(node.argument))
                    disqualified = true;
                break;
            case 'ArrowFunctionExpression': {
                const isCallback = parent?.type === 'CallExpression' && parent.arguments.includes(node) &&
                    CALLBACK_METHODS.has(propertyName(parent.callee) ?? '');
                const body = node.body;
                const simpleBody = body.type !== 'BlockStatement' ||
                    (body.body.length === 1 && body.body[0].type === 'ReturnStatement');
                if (!isCallback || !simpleBody || node.async ||
                    node.params.some((p) => p.type !== 'Identifier' || isReservedName(p.name))) {
                    disqualified = true;
                }
                break;
            }
            case 'CallExpression': {
                const callee = node.callee;
                if (callee.type === 'Identifier') {
                    if (!ALLOWED_FUNCTIONS.has(callee.name))
                        disqualified = true;
                    break;
                }
                const method = propertyName(callee);
                if (!method || !ALLOWED_METHODS.has(method)) {
                    disqualified = true;
                    break;
                }
                if (isHttpRequestCall(node)) {
                    httpCalls++;
                    break;
                }
                const object = callee.object;
                if (isIdentifier(object, 'Object') || isHelpers(object)) {
                    disqualified = true;
                    break;
                }
                if (CALLBACK_METHODS.has(method))
                    methods.set(method, [...(methods.get(method) ?? []), node]);
                break;
            }
        }
    });
    if (disqualified || (inits.has('items') && !isItemsSource(inits.get('items'))))
        return undefined;
    const callbacks = [...methods.values()].flat().map(call => call.arguments[0]).filter(Boolean);
    const nodeReturns = returns.filter(ret => !callbacks.some(callback => contains(callback, ret)));
    returns.length = 0;
    returns.push(...nodeReturns);
    if (returns.length !== 1)
        return undefined;
    if (reusesComputedVariable(program, inits) || sharesChangingValue(program, inits))
        return undefined;
    const resolve = (node, depth = 0) => {
        if (!node || depth > 5)
            return node;
        if (node.type === 'Identifier' && inits.has(node.name))
            return resolve(inits.get(node.name), depth + 1);
        if (node.type === 'ChainExpression')
            return resolve(node.expression, depth + 1);
        if (node.type === 'CallExpression' && propertyName(node.callee) === 'flat')
            return resolve(node.callee.object, depth + 1);
        return node;
    };
    const isItems = (node) => isItemsSource(resolve(node));
    const returnedAsItems = (call) => returns.some(ret => resolve(ret.argument) === call);
    const callsOnItems = (method) => (methods.get(method) ?? []).filter(call => isItems(call.callee.object));
    const readsWholeInput = readsBeyondFirstItem(program, inits);
    const result = (kind, executeOnce = false) => executeOnce && readsWholeInput ? undefined : { kind, ...ALTERNATIVES[kind], executeOnce };
    const allCalls = new Set([...methods.values()].flat());
    const returnShapesOk = returns.every(ret => {
        const value = resolve(ret.argument);
        if (!value)
            return false;
        if (value.type === 'ObjectExpression')
            return true;
        if (value.type === 'ArrayExpression')
            return value.elements.length === 1 && value.elements[0]?.type === 'ObjectExpression';
        if (allCalls.has(value))
            return true;
        return perItem && propertyName(value) === 'item' && isIdentifier(value.object, '$input');
    });
    if (!returnShapesOk)
        return undefined;
    const itemObjects = [
        ...returns.flatMap(ret => {
            const value = resolve(ret.argument);
            return value?.type === 'ArrayExpression' ? value.elements : [value];
        }),
        ...(methods.get('map') ?? []).map(call => call.arguments[0]?.type === 'ArrowFunctionExpression'
            ? callbackResult(call.arguments[0]) : undefined)
    ];
    if (itemObjects.some(item => isPairedItem(item) || hasBinaryOutput(item)))
        return undefined;
    if (httpCalls > 0) {
        const returnsResponse = returns.every(ret => isHttpResponse(unwrapItem(resolve(ret.argument), resolve)));
        return httpCalls === 1 && methods.size === 0 && returnsResponse ? result('httpRequest', !perItem) : undefined;
    }
    const otherCalls = (call) => [...allCalls].filter(other => other !== call && !contains(call.arguments[0], other));
    for (const call of callsOnItems('filter')) {
        const callback = call.arguments[0];
        if (!returnedAsItems(call) || callback?.type !== 'ArrowFunctionExpression')
            continue;
        if (otherCalls(call).length > 0)
            return undefined;
        if (callback.params.length === 3)
            return isDedupeCallback(callback) ? result('removeDuplicates') : undefined;
        return callback.params.length === 1 && isSimpleCondition(callback) ? result('filter') : undefined;
    }
    for (const call of callsOnItems('sort')) {
        if (otherCalls(call).length > 0)
            return undefined;
        if (returnedAsItems(call) && isSortKeyComparator(call.arguments[0]))
            return result('sort');
    }
    if (methods.has('sort') || methods.has('filter'))
        return undefined;
    if (methods.has('reduce')) {
        const calls = methods.get('reduce');
        const totals = calls.length === 1 && otherCalls(calls[0]).length === 0 && isItems(calls[0].callee.object) &&
            usedAsFieldValue(calls[0]) && isFieldTotal(calls[0]);
        return totals ? result('summarize') : undefined;
    }
    if (['find', 'some', 'every', 'findIndex', 'flatMap'].some(method => methods.has(method)))
        return undefined;
    if (methods.has('map')) {
        const calls = methods.get('map');
        if (calls.length !== 1)
            return undefined;
        const call = calls[0];
        const callback = call.arguments[0];
        if (callback?.type !== 'ArrowFunctionExpression')
            return undefined;
        if (callback.params.length > 1)
            return undefined;
        const mapped = callbackResult(callback);
        if (!mapped)
            return undefined;
        const returned = returnedAsItems(call);
        const param = callback.params[0]?.name;
        if (isItems(call.callee.object)) {
            if (returned)
                return mapped.type === 'ObjectExpression' && buildsFields(mapped, resolve) ? result('editFields') : undefined;
            if (isJoined(call, program))
                return result('editFields', true);
            return usedAsFieldValue(call) && isAggregatedValue(mapped, param) ? result('aggregate') : undefined;
        }
        return isWholeRowItem(mapped, param) && returned && isInputField(resolve(call.callee.object))
            ? result('splitOut', !perItem)
            : undefined;
    }
    const buildsObject = returns.some(ret => buildsFields(resolve(ret.argument), resolve));
    return buildsObject || assignsItemField ? result('editFields', !perItem) : undefined;
    function usedAsFieldValue(call) {
        let used = false;
        for (const ret of returns) {
            const value = resolve(ret.argument);
            if (!value)
                continue;
            walk(value, (node) => {
                if (node.type === 'Property' && resolve(node.value) === call)
                    used = true;
            });
        }
        return used;
    }
}
function isSimpleCondition(callback) {
    const params = new Set(callback.params.map((param) => param.name));
    let simple = true;
    walk(callback.body, (node, parent) => {
        if (!simple)
            return;
        if (node.type === 'Identifier' && !isPropertyName(node, parent)) {
            if (!params.has(node.name) && !CALLBACK_GLOBALS.has(node.name))
                simple = false;
        }
        if (node.type === 'ArrowFunctionExpression' || node.type === 'ArrayExpression' || node.type === 'ObjectExpression')
            simple = false;
        if (node.type === 'CallExpression') {
            const callee = node.callee;
            if (callee.type === 'Identifier') {
                if (!CONDITION_FUNCTIONS.has(callee.name))
                    simple = false;
            }
            else if (propertyName(callee) === 'now' && isIdentifier(callee.object, 'Date')) {
            }
            else if (!CONDITION_METHODS.has(propertyName(callee) ?? '') || !params.has(rootOf(callee)?.name)) {
                simple = false;
            }
        }
    });
    return simple;
}
function isSortKeyComparator(callback) {
    if (callback?.type !== 'ArrowFunctionExpression' || callback.params.length !== 2)
        return false;
    const [a, b] = callback.params.map((param) => param.name);
    const body = callbackResult(callback);
    if (body?.type !== 'BinaryExpression' || body.operator !== '-')
        return false;
    const left = fieldPath(body.left);
    const right = fieldPath(body.right);
    return left !== undefined && right !== undefined && isDataPath(left.segments) &&
        JSON.stringify(left.segments) === JSON.stringify(right.segments) &&
        ((left.root === a && right.root === b) || (left.root === b && right.root === a));
}
function isDataPath(segments) {
    return segments.length >= 2 && segments[0] === 'json';
}
function isDedupeCallback(callback) {
    const [item, index, all] = callback.params.map((param) => param.name);
    const body = callbackResult(callback);
    if (body?.type !== 'BinaryExpression' || !['===', '=='].includes(body.operator))
        return false;
    const sides = [body.left, body.right];
    const indexSide = sides.find(side => isIdentifier(side, index));
    const lookup = sides.find(side => side !== indexSide);
    if (!indexSide || lookup?.type !== 'CallExpression' || !isIdentifier(lookup.callee.object, all))
        return false;
    if (propertyName(lookup.callee) !== 'findIndex')
        return false;
    const inner = lookup.arguments[0];
    if (inner?.type !== 'ArrowFunctionExpression' || inner.params.length !== 1)
        return false;
    const other = inner.params[0].name;
    if ([item, index, all].includes(other))
        return false;
    return isFieldEquality(callbackResult(inner), other, item);
}
function readsBeyondFirstItem(program, inits) {
    const aliases = new Set();
    for (let changed = true; changed;) {
        changed = false;
        for (const [name, init] of inits) {
            if (aliases.has(name))
                continue;
            if (isItemsSource(init) || (init.type === 'Identifier' && aliases.has(init.name))) {
                aliases.add(name);
                changed = true;
            }
        }
    }
    let reads = false;
    walk(program, (node, parent) => {
        if (reads)
            return;
        if (node.type === 'CallExpression' && ((propertyName(node.callee) === 'last' && isIdentifier(node.callee.object, '$input')) ||
            (isIdentifier(node.callee, '$items') && typeof node.arguments[0]?.value !== 'string'))) {
            reads = true;
            return;
        }
        const isList = isItemsSource(node) || (node.type === 'Identifier' && aliases.has(node.name));
        if (!isList || isPropertyName(node, parent))
            return;
        if (parent?.type === 'VariableDeclarator' && parent.init === node)
            return;
        if (parent?.type === 'VariableDeclarator' && parent.id === node)
            return;
        const firstItem = parent?.type === 'MemberExpression' && parent.object === node && parent.computed &&
            parent.property.type === 'Literal' && parent.property.value === 0;
        if (!firstItem)
            reads = true;
    });
    return reads;
}
function contains(node, target) {
    if (!node)
        return false;
    let found = false;
    walk(node, (child) => { if (child === target)
        found = true; });
    return found;
}
function hasBinaryOutput(node) {
    return node?.type === 'ObjectExpression' && node.properties.some((property) => keyName(property) === 'binary');
}
function isPairedItem(node) {
    if (node?.type !== 'ObjectExpression')
        return false;
    const keys = node.properties.map(keyName);
    return keys.includes('json') && keys.includes('pairedItem');
}
function isAggregatedValue(node, param) {
    const path = fieldPath(node);
    return path !== undefined && path.root === param && path.segments.length >= 1 && path.segments[0] === 'json';
}
function isWholeRowItem(node, param) {
    return node.type === 'ObjectExpression' && node.properties.length === 1 && keyName(node.properties[0]) === 'json' &&
        !node.properties[0].computed && isIdentifier(node.properties[0].value, param ?? '');
}
function isFieldEquality(node, a, b) {
    if (!node)
        return false;
    if (node.type === 'LogicalExpression' && node.operator === '&&') {
        return isFieldEquality(node.left, a, b) && isFieldEquality(node.right, a, b);
    }
    if (node.type !== 'BinaryExpression' || node.operator !== '===')
        return false;
    const left = fieldPath(node.left);
    const right = fieldPath(node.right);
    if (!left || !right || !isDataPath(left.segments) ||
        JSON.stringify(left.segments) !== JSON.stringify(right.segments))
        return false;
    return (left.root === a && right.root === b) || (left.root === b && right.root === a);
}
function fieldPath(node) {
    const segments = [];
    let current = node.type === 'ChainExpression' ? node.expression : node;
    while (current.type === 'MemberExpression') {
        const name = propertyName(current);
        if (name === undefined)
            return undefined;
        segments.unshift(name);
        current = current.object;
    }
    return current.type === 'Identifier' ? { root: current.name, segments } : undefined;
}
function isReservedName(name) {
    return name.startsWith('$') || ALLOWED_FUNCTIONS.has(name) || CALLBACK_GLOBALS.has(name) ||
        ['JSON', 'Object'].includes(name);
}
function unwrapItem(node, resolve) {
    let value = node;
    if (value?.type === 'ArrayExpression' && value.elements.length === 1)
        value = resolve(value.elements[0]);
    if (value?.type === 'ObjectExpression' && value.properties.length === 1 && keyName(value.properties[0]) === 'json') {
        value = resolve(value.properties[0].value);
    }
    return value;
}
function isHttpResponse(node) {
    return node?.type === 'AwaitExpression' && isHttpRequestCall(node.argument);
}
function isFieldTotal(call) {
    const [callback, initial] = call.arguments;
    if (callback?.type !== 'ArrowFunctionExpression' || callback.params.length !== 2)
        return false;
    if (initial?.type !== 'Literal' || initial.value !== 0)
        return false;
    const body = callbackResult(callback);
    if (body?.type !== 'BinaryExpression' || body.operator !== '+' || !isIdentifier(body.left, callback.params[0].name))
        return false;
    const field = fieldPath(body.right);
    return field !== undefined && field.root === callback.params[1].name && isDataPath(field.segments);
}
function buildsFields(node, resolve) {
    if (!node)
        return false;
    if (node.type === 'ArrayExpression')
        return node.elements.some((element) => buildsFields(element, resolve));
    if (node.type !== 'ObjectExpression')
        return false;
    const properties = node.properties;
    if (properties.length === 0)
        return false;
    if (properties.every((property) => property.type === 'SpreadElement'))
        return false;
    if (properties.length === 1 && keyName(properties[0]) === 'json')
        return buildsFields(resolve(properties[0].value), resolve);
    return true;
}
function isCurrentItemJson(node) {
    if (node.type === 'Identifier')
        return node.name === '$json';
    if (propertyName(node) !== 'json')
        return false;
    const owner = node.object;
    if (owner.type === 'Identifier')
        return true;
    if (propertyName(owner) === 'item' && isIdentifier(owner.object, '$input'))
        return true;
    return owner.type === 'CallExpression' && propertyName(owner.callee) === 'first' && isIdentifier(owner.callee.object, '$input');
}
function isCurrentItemField(node) {
    if (node.type !== 'MemberExpression')
        return false;
    let owner = node.object;
    while (owner.type === 'MemberExpression' && !(propertyName(owner) === 'json' && isInputItem(owner.object))) {
        owner = owner.object;
    }
    return isIdentifier(owner, '$json') || (propertyName(owner) === 'json' && isInputItem(owner.object));
}
function isInputItem(node) {
    return propertyName(node) === 'item' && isIdentifier(node.object, '$input');
}
function isIndexArithmetic(node) {
    if (node.type === 'Literal')
        return true;
    if (node.type === 'MemberExpression')
        return propertyName(node) === 'length';
    if (node.type === 'BinaryExpression')
        return isIndexArithmetic(node.left) && isIndexArithmetic(node.right);
    return false;
}
function isJoined(call, program) {
    let joined = false;
    walk(program, (node) => {
        if (node.type === 'CallExpression' && propertyName(node.callee) === 'join' && node.callee.object === call)
            joined = true;
    });
    return joined;
}
function reusesComputedVariable(program, inits) {
    const computed = new Set();
    for (const [name, init] of inits) {
        const value = init.type === 'ChainExpression' ? init.expression : init;
        if (COMPUTED_INITIALIZERS.has(value.type))
            computed.add(name);
    }
    if (computed.size === 0)
        return false;
    const uses = new Map();
    walk(program, (node, parent) => {
        if (node.type !== 'Identifier' || !computed.has(node.name))
            return;
        if (parent?.type === 'VariableDeclarator' && parent.id === node)
            return;
        if (isPropertyName(node, parent))
            return;
        uses.set(node.name, (uses.get(node.name) ?? 0) + 1);
    });
    return [...uses.values()].some(count => count > 1);
}
function isChangingValue(node, changing) {
    let found = false;
    walk(node, (child, parent) => {
        if (child.type === 'Identifier' && (child.name === '$now' || changing.has(child.name)) && !isPropertyName(child, parent))
            found = true;
        if (child.type === 'CallExpression' && ['random', 'now'].includes(propertyName(child.callee) ?? ''))
            found = true;
        if (child.type === 'NewExpression' && child.arguments.length === 0)
            found = true;
    });
    return found;
}
function sharesChangingValue(program, inits) {
    const changing = new Set();
    for (let added = true; added;) {
        added = false;
        for (const [name, init] of inits) {
            if (changing.has(name))
                continue;
            if (isChangingValue(init, changing)) {
                changing.add(name);
                added = true;
            }
        }
    }
    if (changing.size === 0)
        return false;
    const callbacks = [];
    walk(program, (node) => { if (node.type === 'ArrowFunctionExpression')
        callbacks.push(node); });
    let shared = false;
    walk(program, (node, parent) => {
        if (shared || node.type !== 'Identifier' || !changing.has(node.name) || isPropertyName(node, parent))
            return;
        if (callbacks.some(callback => contains(callback, node)))
            shared = true;
    });
    return shared;
}
function isInputField(node) {
    if (node?.type !== 'MemberExpression')
        return false;
    if (isIdentifier(rootOf(node), '$json'))
        return true;
    for (let current = node; current.type === 'MemberExpression'; current = current.object) {
        if (current !== node && propertyName(current) === 'json' && isFirstOrCurrentItem(current.object))
            return true;
    }
    return false;
}
function isFirstOrCurrentItem(node) {
    if (isInputItem(node))
        return true;
    if (node.type === 'CallExpression' && propertyName(node.callee) === 'first' && isIdentifier(node.callee.object, '$input'))
        return true;
    return node.type === 'MemberExpression' && node.computed && node.property.type === 'Literal' && node.property.value === 0 &&
        isItemsSource(node.object);
}
//# sourceMappingURL=code-native-alternatives.js.map