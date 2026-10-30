"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowSanitizer = void 0;
const crypto_1 = require("crypto");
const email_redaction_1 = require("./email-redaction");
class WorkflowSanitizer {
    static sanitizeWorkflow(workflow) {
        const sanitized = JSON.parse(JSON.stringify(workflow));
        this.sanitizeGraph(sanitized);
        delete sanitized.settings?.errorWorkflow;
        delete sanitized.staticData;
        delete sanitized.pinData;
        delete sanitized.credentials;
        delete sanitized.sharedWorkflows;
        delete sanitized.ownedBy;
        delete sanitized.createdBy;
        delete sanitized.updatedBy;
        const nodeTypes = sanitized.nodes?.map((n) => n.type) || [];
        const uniqueNodeTypes = [...new Set(nodeTypes)];
        const hasTrigger = nodeTypes.some((type) => type.includes('trigger') || type.includes('webhook'));
        const hasWebhook = nodeTypes.some((type) => type.includes('webhook'));
        const nodeCount = sanitized.nodes?.length || 0;
        let complexity = 'simple';
        if (nodeCount > 20) {
            complexity = 'complex';
        }
        else if (nodeCount > 10) {
            complexity = 'medium';
        }
        const workflowStructure = JSON.stringify({
            nodeTypes: uniqueNodeTypes.sort(),
            connections: sanitized.connections
        });
        const workflowHash = (0, crypto_1.createHash)('sha256')
            .update(workflowStructure)
            .digest('hex')
            .substring(0, 16);
        return {
            nodes: sanitized.nodes || [],
            connections: sanitized.connections || {},
            nodeCount,
            nodeTypes: uniqueNodeTypes,
            hasTrigger,
            hasWebhook,
            complexity,
            workflowHash
        };
    }
    static sanitizeOperations(operations, workflows = []) {
        if (!Array.isArray(operations)) {
            return this.sanitizeTelemetryObject(operations);
        }
        const kinds = this.nodeKindsByKey(workflows);
        for (const op of operations) {
            if (op && typeof op === 'object' && op.node && typeof op.node === 'object' && !Array.isArray(op.node)) {
                this.recordNodeKind(kinds, op.node.id, op.node.name, !this.isKnownNonSticky(op.node.type));
            }
        }
        const isContentPath = (path) => typeof path === 'string' && (path === 'parameters.content' || path.startsWith('parameters.content.'));
        const targetMaySticky = (op) => {
            let found;
            const keys = [];
            if (typeof op.nodeId === 'string')
                keys.push(`id:${op.nodeId}`, this.nodeKey(op.nodeId));
            if (typeof op.nodeName === 'string')
                keys.push(this.nodeKey(op.nodeName));
            for (const key of keys) {
                const kind = kinds.get(key);
                if (kind !== undefined)
                    found = found === true || kind;
            }
            return found;
        };
        const uncertain = operations.some((op) => {
            if (!op || typeof op !== 'object')
                return false;
            const updates = op.updates;
            if (updates && typeof updates === 'object' && !Array.isArray(updates) &&
                Object.keys(updates).some((key) => key === 'type' || key.startsWith('type.'))) {
                return true;
            }
            return op.type === 'patchNodeField' && (op.fieldPath === 'type' || op.fieldPath === 'name');
        });
        const stripped = operations.map((op) => {
            if (!op || typeof op !== 'object' || Array.isArray(op)) {
                return op;
            }
            const { description, ...rest } = op;
            const resolved = targetMaySticky(rest);
            const targetsSticky = uncertain || resolved !== false;
            if (rest.updates && typeof rest.updates === 'object' && !Array.isArray(rest.updates) && typeof rest.updates.name === 'string') {
                this.recordNodeKind(kinds, undefined, rest.updates.name, resolved !== false);
            }
            if (rest.node && typeof rest.node === 'object' && !Array.isArray(rest.node)) {
                const { notes, ...node } = rest.node;
                this.recordNodeKind(kinds, node.id, node.name, !this.isKnownNonSticky(node.type));
                if (this.isStickyType(node.type)) {
                    node.parameters = this.withoutContent(node.parameters);
                }
                rest.node = node;
            }
            if (rest.updates && typeof rest.updates === 'object' && !Array.isArray(rest.updates)) {
                const { notes, ...updates } = rest.updates;
                if (targetsSticky) {
                    for (const key of Object.keys(updates)) {
                        if (isContentPath(key))
                            delete updates[key];
                    }
                    if (updates.parameters !== undefined) {
                        updates.parameters = this.withoutContent(updates.parameters);
                    }
                }
                rest.updates = updates;
            }
            if (rest.type === 'patchNodeField' && (rest.fieldPath === 'notes' || (targetsSticky && isContentPath(rest.fieldPath)))) {
                delete rest.patches;
            }
            if (Array.isArray(rest.nodeGroups)) {
                rest.nodeGroups = this.stripGroupDescriptions(rest.nodeGroups);
            }
            if (rest.settings && typeof rest.settings === 'object' && !Array.isArray(rest.settings)) {
                const { errorWorkflow, ...settings } = rest.settings;
                rest.settings = settings;
            }
            return rest;
        });
        return this.sanitizeTelemetryObject(stripped);
    }
    static stripGroupDescriptions(groups) {
        return groups.map((group) => {
            if (!group || typeof group !== 'object' || Array.isArray(group)) {
                return group;
            }
            const { description, ...kept } = group;
            return kept;
        });
    }
    static sanitizeTelemetryObject(value) {
        if (value === null || value === undefined) {
            return value;
        }
        if (typeof value === 'string') {
            return this.sanitizeString(value);
        }
        return this.sanitizeObject(value);
    }
    static sanitizeNode(node) {
        if (!node || typeof node !== 'object') {
            return node;
        }
        const { id, name, type, typeVersion, position, parameters, credentials, notes, ...rest } = node;
        const sanitized = { ...this.sanitizeObject(rest), id, name, type, position };
        if (typeVersion !== undefined)
            sanitized.typeVersion = typeVersion;
        if (parameters) {
            sanitized.parameters = this.sanitizeObject(this.isStickyType(type) ? this.withoutContent(parameters) : parameters);
        }
        else if (parameters !== undefined) {
            sanitized.parameters = parameters;
        }
        return sanitized;
    }
    static isStickyType(type) {
        return typeof type === 'string' && /stickynote$/i.test(type);
    }
    static isKnownNonSticky(type) {
        return typeof type === 'string' && !this.isStickyType(type);
    }
    static withoutContent(parameters) {
        if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
            return parameters;
        }
        const { content, ...rest } = parameters;
        return rest;
    }
    static nodeKey(name) {
        return `name:${name.replace(/\\/g, '').replace(/\s+/g, ' ').trim().toLowerCase()}`;
    }
    static nodeKindsByKey(workflows) {
        const kinds = new Map();
        for (const workflow of workflows) {
            if (!workflow || !Array.isArray(workflow.nodes))
                continue;
            for (const node of workflow.nodes) {
                if (node && typeof node === 'object')
                    this.recordNodeKind(kinds, node.id, node.name, !this.isKnownNonSticky(node.type));
            }
        }
        return kinds;
    }
    static recordNodeKind(kinds, id, name, maySticky) {
        const keys = [];
        if (typeof id === 'string')
            keys.push(`id:${id}`, this.nodeKey(id));
        if (typeof name === 'string')
            keys.push(this.nodeKey(name));
        for (const key of keys) {
            kinds.set(key, kinds.get(key) === true || maySticky);
        }
    }
    static sanitizeGraph(workflow) {
        if (Array.isArray(workflow.nodes)) {
            workflow.nodes = workflow.nodes.map((node) => {
                const sanitized = this.sanitizeNode(node);
                if (sanitized && typeof sanitized.name === 'string') {
                    sanitized.name = this.sanitizeNodeName(sanitized.name);
                }
                return sanitized;
            });
        }
        else if (workflow.nodes !== undefined) {
            workflow.nodes = this.sanitizeTelemetryObject(workflow.nodes);
        }
        if (workflow.connections !== undefined) {
            workflow.connections = this.sanitizeConnections(workflow.connections);
        }
    }
    static sanitizeNodeName(name) {
        const sanitized = this.sanitizeString(name);
        if (sanitized === name) {
            return name;
        }
        return `${sanitized} #${(0, crypto_1.createHash)('sha256').update(name).digest('hex').substring(0, 8)}`;
    }
    static sanitizeObject(obj) {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map((item) => (typeof item === 'string' ? this.sanitizeString(item) : this.sanitizeObject(item)));
        }
        const sanitized = {};
        const sibling = [obj.name, obj.field].find((v) => typeof v === 'string');
        const resourceLocatorMode = obj.__rl === true && typeof obj.mode === 'string' ? obj.mode : undefined;
        for (const [key, value] of Object.entries(obj)) {
            let kind = this.classifyKey(key);
            if (kind === 'none' && key === 'value') {
                if (resourceLocatorMode === 'url') {
                    kind = 'url';
                }
                else if (sibling !== undefined) {
                    kind = this.classifyParamName(sibling);
                }
            }
            if (kind === 'url') {
                sanitized[key] = this.redactUrlValue(value);
            }
            else if (kind === 'secret') {
                sanitized[key] = this.redactSecret(value);
            }
            else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeObject(value);
            }
            else if (typeof value === 'string') {
                const isResourceLocatorId = resourceLocatorMode !== undefined && key === 'value';
                sanitized[key] = this.sanitizeString(value, !isResourceLocatorId);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    static sanitizeString(value, redactOpaqueTokens = true) {
        if (value.length > this.MAX_STRING_LENGTH) {
            return '[REDACTED_LONG_STRING]';
        }
        const structured = this.sanitizeJsonText(value);
        if (structured === undefined) {
            return this.sanitizeText(value, redactOpaqueTokens);
        }
        if (structured.length > this.MAX_STRING_LENGTH) {
            return '[REDACTED_LONG_STRING]';
        }
        const fromStructure = this.sanitizeText(structured, redactOpaqueTokens);
        const fromText = this.sanitizeText(value, redactOpaqueTokens);
        return this.sameJson(fromText, fromStructure) ? fromText : fromStructure;
    }
    static sameJson(a, b) {
        if (a.startsWith('=') !== b.startsWith('='))
            return false;
        try {
            const parse = (text) => JSON.stringify(JSON.parse(text.startsWith('=') ? text.slice(1) : text));
            return parse(a) === parse(b);
        }
        catch {
            return false;
        }
    }
    static sanitizeJsonText(value) {
        const prefix = value.startsWith('=') ? '=' : '';
        const body = prefix ? value.slice(1) : value;
        const trimmed = body.trim();
        const first = trimmed[0];
        const last = trimmed[trimmed.length - 1];
        if (!((first === '{' && last === '}') || (first === '[' && last === ']'))) {
            return undefined;
        }
        if (this.jsonDepth === 0) {
            this.jsonBudget = this.MAX_JSON_WORK;
        }
        if (body.length > this.jsonBudget) {
            return prefix + '[REDACTED_NESTED_JSON]';
        }
        this.jsonBudget -= body.length;
        let parsed;
        try {
            parsed = JSON.parse(body);
        }
        catch {
            return undefined;
        }
        if (!parsed || typeof parsed !== 'object') {
            return undefined;
        }
        if (this.jsonDepth >= this.MAX_JSON_DEPTH || this.jsonNesting(body) > this.MAX_JSON_NESTING) {
            return prefix + '[REDACTED_NESTED_JSON]';
        }
        this.jsonDepth++;
        try {
            const sanitized = this.sanitizeObject(parsed);
            const output = JSON.stringify(sanitized);
            return output === JSON.stringify(parsed) ? undefined : prefix + output;
        }
        finally {
            this.jsonDepth--;
        }
    }
    static jsonNesting(text) {
        let depth = 0;
        let max = 0;
        let inString = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (inString) {
                if (c === '\\')
                    i++;
                else if (c === '"')
                    inString = false;
            }
            else if (c === '"') {
                inString = true;
            }
            else if (c === '{' || c === '[') {
                depth++;
                if (depth > max) {
                    max = depth;
                    if (max > this.MAX_JSON_NESTING)
                        return max;
                }
            }
            else if (c === '}' || c === ']') {
                depth--;
            }
        }
        return max;
    }
    static sanitizeText(value, redactOpaqueTokens) {
        let sanitized = this.applyPatterns(this.redactKeyedLiterals(value.replace(/\u0000/g, '')), this.SENSITIVE_PATTERNS);
        const uuids = [];
        sanitized = sanitized.replace(this.UUID_PATTERN, (uuid) => {
            uuids.push(uuid);
            return `\u0000uuid${uuids.length - 1}\u0000`;
        });
        sanitized = this.applyPatterns((0, email_redaction_1.redactEmailAddresses)(sanitized, this.EMAIL_DOMAIN, '[REDACTED_EMAIL]'), this.PII_PATTERNS);
        if (redactOpaqueTokens && /\d/.test(sanitized)) {
            for (const pattern of this.OPAQUE_TOKEN_PATTERNS) {
                sanitized = sanitized.replace(pattern, '[REDACTED_TOKEN]');
            }
        }
        return uuids.length === 0
            ? sanitized
            : sanitized.replace(this.UUID_SHIELD, (marker, index) => uuids[Number(index)] ?? marker);
    }
    static applyPatterns(value, patterns) {
        let result = value;
        for (const { pattern, placeholder, requires } of patterns) {
            if (requires !== undefined && !result.includes(requires))
                continue;
            result = typeof placeholder === 'string'
                ? result.replace(pattern, placeholder)
                : result.replace(pattern, placeholder);
        }
        return result;
    }
    static redactJwts(token) {
        if (!token.includes('eyJ'))
            return token;
        const runs = token.split('.');
        const out = [];
        let i = 0;
        while (i < runs.length) {
            const run = runs[i];
            const start = this.jwtStart(run);
            const third = i + 2 < runs.length ? runs[i + 2] : undefined;
            const thirdEnd = third === undefined ? -1 : this.lastWordCharEnd(third);
            if (start >= 0 && run.length - start - 3 >= 10 && third !== undefined &&
                runs[i + 1].length >= 10 && thirdEnd >= 10) {
                out.push(run.slice(0, start) + '[REDACTED_JWT]' + third.slice(thirdEnd));
                i += 3;
            }
            else {
                out.push(run);
                i += 1;
            }
        }
        return out.join('.');
    }
    static jwtStart(run) {
        for (let at = run.indexOf('eyJ'); at >= 0; at = run.indexOf('eyJ', at + 1)) {
            if (at === 0 || run[at - 1] === '-')
                return at;
        }
        return -1;
    }
    static lastWordCharEnd(run) {
        let end = run.length;
        while (end > 0 && run[end - 1] === '-')
            end--;
        return end;
    }
    static redactKeyedLiterals(text) {
        if (!/["']/.test(text) || !/[:=]/.test(text))
            return text;
        const n = text.length;
        const nextDouble = new Int32Array(n + 1).fill(n);
        const nextSingle = new Int32Array(n + 1).fill(n);
        const nextBreak = new Int32Array(n + 1).fill(n);
        const escaped = new Uint8Array(n);
        for (let j = 0, backslashes = 0; j < n; j++) {
            escaped[j] = backslashes % 2;
            backslashes = text.charCodeAt(j) === 92 ? backslashes + 1 : 0;
        }
        for (let j = n - 1; j >= 0; j--) {
            const c = text[j];
            nextDouble[j] = c === '"' && !escaped[j] ? j : nextDouble[j + 1];
            nextSingle[j] = c === "'" && !escaped[j] ? j : nextSingle[j + 1];
            nextBreak[j] = c === '\n' || c === '\r' ? j : nextBreak[j + 1];
        }
        const parts = [];
        let copied = 0;
        let floor = 0;
        let previous;
        for (let i = 0; i < n;) {
            const c = text[i];
            if (c !== '"' && c !== "'") {
                i++;
                continue;
            }
            const close = (c === '"' ? nextDouble : nextSingle)[i + 1];
            if (close >= n || close > nextBreak[i + 1]) {
                i++;
                continue;
            }
            const key = this.keyBefore(text, i, floor, previous);
            if (key !== undefined && this.classifyKey(key) === 'secret') {
                parts.push(text.slice(copied, i + 1), String(this.redactSecret(text.slice(i + 1, close))));
                copied = close;
            }
            previous = [i, close + 1];
            floor = close + 1;
            i = close + 1;
        }
        if (copied === 0)
            return text;
        parts.push(text.slice(copied));
        return parts.join('');
    }
    static keyBefore(text, start, floor, previous) {
        const isSpace = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
        let j = start - 1;
        while (j >= floor && isSpace(text[j]))
            j--;
        if (j < floor)
            return undefined;
        const separator = text[j];
        if (separator === '=') {
            const before = text[j - 1];
            if (j - 1 >= floor && (before === '=' || before === '!' || before === '<' || before === '>'))
                return undefined;
        }
        else if (separator !== ':') {
            return undefined;
        }
        j--;
        while (j >= floor && isSpace(text[j]))
            j--;
        if (previous !== undefined && j === previous[1] - 1 && j === floor - 1) {
            return text.slice(previous[0] + 1, previous[1] - 1);
        }
        const end = j + 1;
        while (j >= floor && end - j <= 64 && /[\w$.-]/.test(text[j]))
            j--;
        return end - j > 1 ? text.slice(j + 1, end) : undefined;
    }
    static redactSecret(value) {
        if (typeof value !== 'string' && typeof value !== 'object') {
            return value;
        }
        const scheme = typeof value === 'string' ? value.match(this.AUTH_SCHEME_PREFIX) : null;
        return scheme ? `${scheme[1]} [REDACTED]` : '[REDACTED]';
    }
    static redactUrlValue(value) {
        if (typeof value === 'string') {
            return '[REDACTED_URL]';
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.redactUrlValue(item));
        }
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.redactUrlValue(v)]));
        }
        return value;
    }
    static classifyKey(key) {
        if (key.length > this.MAX_KEY_LENGTH) {
            return 'secret';
        }
        const words = this.keyWords(key);
        const joined = words.join('');
        const last = words[words.length - 1];
        if (last === 'id' || this.COUNT_WORDS.has(last)) {
            return 'none';
        }
        if (words.some((word) => this.URL_KEY_WORDS.has(word))) {
            return 'url';
        }
        if (last === 'auth' ||
            this.SECRET_KEYS.has(joined) ||
            words.some((word) => this.SECRET_KEY_WORDS.has(word) || this.TOPOLOGY_KEY_WORDS.has(word)) ||
            this.SECRET_KEY_COMPOUNDS.some((compound) => joined.includes(compound))) {
            return 'secret';
        }
        return 'none';
    }
    static keyWords(key) {
        return key
            .replace(/(?<![A-Z])([A-Z]{2,})s(?![a-z])/g, '$1S')
            .split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|[^A-Za-z0-9]+/)
            .map((word) => word.toLowerCase().replace(/(?<!\d)\d+$/, ''))
            .filter(Boolean);
    }
    static classifyParamName(name) {
        const kind = this.classifyKey(name);
        if (kind !== 'none')
            return kind;
        const words = this.keyWords(name);
        const last = words[words.length - 1];
        if (last === undefined || this.COUNT_WORDS.has(last))
            return 'none';
        return this.SECRET_PARAM_LAST_WORDS.has(last) || (words.length === 1 && this.SECRET_PARAM_NAMES.has(last))
            ? 'secret'
            : 'none';
    }
    static sanitizeConnections(connections) {
        if (!connections || typeof connections !== 'object' || Array.isArray(connections)) {
            return this.sanitizeTelemetryObject(connections);
        }
        const sanitized = {};
        for (const [sourceName, nodeConnections] of Object.entries(connections)) {
            const nodeId = this.sanitizeNodeName(sourceName);
            if (typeof nodeConnections === 'object' && nodeConnections !== null && !Array.isArray(nodeConnections)) {
                sanitized[nodeId] = {};
                for (const [connType, connArray] of Object.entries(nodeConnections)) {
                    if (Array.isArray(connArray)) {
                        sanitized[nodeId][connType] = connArray.map((conns) => {
                            if (Array.isArray(conns)) {
                                return conns.map((conn) => conn && typeof conn === 'object'
                                    ? {
                                        node: typeof conn.node === 'string' ? this.sanitizeNodeName(conn.node) : conn.node,
                                        type: conn.type,
                                        index: conn.index
                                    }
                                    : this.sanitizeTelemetryObject(conn));
                            }
                            return this.sanitizeTelemetryObject(conns);
                        });
                    }
                    else {
                        sanitized[nodeId][connType] = this.sanitizeTelemetryObject(connArray);
                    }
                }
            }
            else {
                sanitized[nodeId] = this.sanitizeTelemetryObject(nodeConnections);
            }
        }
        return sanitized;
    }
    static generateWorkflowHash(workflow) {
        const sanitized = this.sanitizeWorkflow(workflow);
        return sanitized.workflowHash;
    }
    static sanitizeWorkflowRaw(workflow) {
        return this.sanitizeWorkflowRawInPlace(JSON.parse(JSON.stringify(workflow)), 0);
    }
    static sanitizeWorkflowRawInPlace(sanitized, depth) {
        this.sanitizeGraph(sanitized);
        delete sanitized.settings?.errorWorkflow;
        delete sanitized.staticData;
        delete sanitized.pinData;
        delete sanitized.credentials;
        delete sanitized.sharedWorkflows;
        delete sanitized.ownedBy;
        delete sanitized.createdBy;
        delete sanitized.updatedBy;
        delete sanitized.description;
        delete sanitized.shared;
        delete sanitized.homeProject;
        if (Array.isArray(sanitized.nodeGroups)) {
            sanitized.nodeGroups = this.stripGroupDescriptions(sanitized.nodeGroups);
        }
        const isWorkflowLike = (value) => !!value && typeof value === 'object' && Array.isArray(value.nodes);
        const nested = (value) => depth < this.MAX_NESTED_WORKFLOW_DEPTH
            ? this.sanitizeWorkflowRawInPlace(value, depth + 1)
            : '[REDACTED_NESTED_WORKFLOW]';
        const { nodes, connections, ...rest } = sanitized;
        const others = {};
        for (const [key, value] of Object.entries(rest)) {
            if (isWorkflowLike(value)) {
                sanitized[key] = nested(value);
            }
            else if (Array.isArray(value) && value.some(isWorkflowLike)) {
                sanitized[key] = value.map((item) => isWorkflowLike(item) ? nested(item) : this.sanitizeTelemetryObject(item));
            }
            else {
                others[key] = value;
            }
        }
        Object.assign(sanitized, this.sanitizeObject(others));
        return sanitized;
    }
}
exports.WorkflowSanitizer = WorkflowSanitizer;
WorkflowSanitizer.SENSITIVE_PATTERNS = [
    {
        pattern: /https?:\/\/[^\s"'`<>(){}\[\],;]*/gi,
        placeholder: (url) => (WorkflowSanitizer.WEBHOOK_PATH.test(url.replace(/^https?:\/\//i, '')) ? '[REDACTED_WEBHOOK]' : url),
    },
    { pattern: /https?:\/\/[^\s/]+\/hook\/[^\s"'`<>(){}\[\],;]+/gi, placeholder: '[REDACTED_WEBHOOK]' },
    { pattern: /https?:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/gi, placeholder: '[REDACTED_WEBHOOK]' },
    { pattern: /https?:\/\/n8n\.[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:[/?#][^\s"'<>]*)?/gi, placeholder: '[REDACTED_N8N_HOST_URL]' },
    { pattern: /https?:\/\/[a-z]{20}\.supabase\.co(?:[/?#][^\s"'<>]*)?/gi, placeholder: '[REDACTED_SUPABASE_URL]' },
    { pattern: /https?:\/\/[^\s/:@"'`<>,;()]+:[^\s/@"'`<>,;()]+@[^\s/"'`<>,;)\]}]+/gi, placeholder: '[REDACTED_URL_WITH_AUTH]' },
    { pattern: /wss?:\/\/[^\s/:@"'`<>,;()]+:[^\s/@"'`<>,;()]+@[^\s/"'`<>,;)\]}]+/gi, placeholder: '[REDACTED_URL_WITH_AUTH]' },
    { pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s/:@"'`<>,;()]+:[^\s/@"'`<>,;()]+@[^\s"'`<>,;)\]}]+/gi, placeholder: '[REDACTED_URL_WITH_AUTH]' },
    { pattern: /([?&](?:access_token|api_key|apikey|api-key|token|key|secret|password|pwd|signature|sig|auth)=)[^&\s"'`<>]+/gi, placeholder: '$1[REDACTED]' },
    { pattern: /Bearer\s+(?![{$[])[^\s'"`,;{}\]]+/gi, placeholder: 'Bearer [REDACTED]' },
    { pattern: /\bBasic\s+(?=[A-Za-z0-9+/]*\d)[A-Za-z0-9+/]{12,}={0,2}/g, placeholder: 'Basic [REDACTED]' },
    { pattern: /[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*/g, placeholder: (token) => WorkflowSanitizer.redactJwts(token), requires: 'eyJ' },
    { pattern: /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{20,}\b/g, placeholder: '[REDACTED_SUPABASE_KEY]' },
    { pattern: /\bsk-proj-[A-Za-z0-9_-]{40,}\b/g, placeholder: '[REDACTED_LLM_API_KEY]' },
    { pattern: /\bsk-or-(?:v1-)?[A-Za-z0-9-]{40,}\b/g, placeholder: '[REDACTED_LLM_API_KEY]' },
    { pattern: /\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{24,}\b/g, placeholder: '[REDACTED_STRIPE_KEY]' },
    { pattern: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g, placeholder: '[REDACTED_API_TOKEN]' },
    { pattern: /\bghp_[A-Za-z0-9]{36,}\b/g, placeholder: '[REDACTED_API_TOKEN]' },
    { pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/g, placeholder: '[REDACTED_API_TOKEN]' },
    { pattern: /\bhf_[A-Za-z0-9]{30,}\b/g, placeholder: '[REDACTED_API_TOKEN]' },
    { pattern: /\bntn_[A-Za-z0-9]{40,}\b/g, placeholder: '[REDACTED_API_TOKEN]' },
    { pattern: /\bpit-[a-f0-9-]{36}\b/g, placeholder: '[REDACTED_API_TOKEN]' },
    { pattern: /\bxox[bpaors]-[A-Za-z0-9-]{10,}\b/g, placeholder: '[REDACTED_API_TOKEN]' },
    { pattern: /\bAKIA[A-Z0-9]{16}\b/g, placeholder: '[REDACTED_API_TOKEN]' },
    { pattern: /\bAIza[A-Za-z0-9_-]{35}\b/g, placeholder: '[REDACTED_API_TOKEN]' },
    { pattern: /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/g, placeholder: '[REDACTED_API_TOKEN]' },
    { pattern: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, placeholder: '[REDACTED_API_TOKEN]' },
    { pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, placeholder: '[REDACTED_LLM_API_KEY]' },
    { pattern: /\bshpat_[a-f0-9]{32}\b/g, placeholder: '[REDACTED_API_TOKEN]' },
    { pattern: /\bsk-[A-Za-z0-9]{16,}\b/g, placeholder: '[REDACTED_LLM_API_KEY]' },
];
WorkflowSanitizer.PII_PATTERNS = [
    { pattern: /(?<![\w-])(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?![\w-])/g, placeholder: '[REDACTED_PHONE]' },
];
WorkflowSanitizer.OPAQUE_TOKEN_PATTERNS = [
    /\b(?!REDACTED)(?=(?:[A-Za-z_-]{0,64}\d){3})(?=[^A-Z]{0,64}[A-Z])(?=[^a-z]{0,64}[a-z])[A-Za-z0-9_-]{32,}\b/g,
    /\b(?!REDACTED)(?=[A-Za-z]{0,64}\d)[A-Za-z0-9]{32,}\b/g,
];
WorkflowSanitizer.UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
WorkflowSanitizer.UUID_SHIELD = /\u0000uuid(\d+)\u0000/g;
WorkflowSanitizer.SECRET_KEY_WORDS = new Set([
    'token',
    'secret',
    'secrets',
    'password',
    'passwords',
    'passwd',
    'pwd',
    'passphrase',
    'authorization',
    'credentials',
    'cookie',
    'cookies',
    'certificate',
]);
WorkflowSanitizer.SECRET_KEYS = new Set(['credential', 'jwt']);
WorkflowSanitizer.COUNT_WORDS = new Set(['limit', 'length', 'count', 'size', 'budget', 'usage']);
WorkflowSanitizer.SECRET_KEY_COMPOUNDS = [
    'apikey',
    'apitoken',
    'accesstoken',
    'refreshtoken',
    'clientsecret',
    'secretkey',
    'authkey',
    'authvalue',
    'privatekey',
    'publickey',
    'accesskey',
    'sshkey',
    'signingkey',
    'encryptionkey',
    'connectionstring',
];
WorkflowSanitizer.TOPOLOGY_KEY_WORDS = new Set([
    'host',
    'hosts',
    'hostname',
    'server',
    'servers',
    'database',
    'databases',
]);
WorkflowSanitizer.URL_KEY_WORDS = new Set([
    'url',
    'urls',
    'endpoint',
    'endpoints',
    'webhook',
    'webhooks',
]);
WorkflowSanitizer.AUTH_SCHEME_PREFIX = /^(Bearer|Basic|Digest)\s+/i;
WorkflowSanitizer.WEBHOOK_PATH = /\/webhook(?:s|-test)?\/./i;
WorkflowSanitizer.SECRET_PARAM_LAST_WORDS = new Set(['key', 'sig', 'signature']);
WorkflowSanitizer.SECRET_PARAM_NAMES = new Set(['code']);
WorkflowSanitizer.MAX_STRING_LENGTH = 100000;
WorkflowSanitizer.MAX_KEY_LENGTH = 256;
WorkflowSanitizer.MAX_NESTED_WORKFLOW_DEPTH = 3;
WorkflowSanitizer.MAX_JSON_DEPTH = 4;
WorkflowSanitizer.MAX_JSON_WORK = 1000000;
WorkflowSanitizer.MAX_JSON_NESTING = 64;
WorkflowSanitizer.jsonDepth = 0;
WorkflowSanitizer.jsonBudget = 0;
WorkflowSanitizer.EMAIL_DOMAIN = /[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/y;
//# sourceMappingURL=workflow-sanitizer.js.map