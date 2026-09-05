"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowSanitizer = void 0;
const crypto_1 = require("crypto");
class WorkflowSanitizer {
    static sanitizeWorkflow(workflow) {
        const sanitized = JSON.parse(JSON.stringify(workflow));
        if (sanitized.nodes && Array.isArray(sanitized.nodes)) {
            sanitized.nodes = sanitized.nodes.map((node) => this.sanitizeNode(node));
        }
        if (sanitized.connections) {
            sanitized.connections = this.sanitizeConnections(sanitized.connections);
        }
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
        const sanitized = { ...node };
        delete sanitized.credentials;
        if (sanitized.parameters) {
            sanitized.parameters = this.sanitizeObject(sanitized.parameters);
        }
        return sanitized;
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
                    kind = this.classifyKey(sibling);
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
        let sanitized = this.applyPatterns(value.replace(/\u0000/g, ''), this.SENSITIVE_PATTERNS);
        const uuids = [];
        sanitized = sanitized.replace(this.UUID_PATTERN, (uuid) => {
            uuids.push(uuid);
            return `\u0000uuid${uuids.length - 1}\u0000`;
        });
        sanitized = this.applyPatterns(sanitized, this.PII_PATTERNS);
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
        for (const { pattern, placeholder } of patterns) {
            result = result.replace(pattern, placeholder);
        }
        return result;
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
        const words = key
            .replace(/([A-Z]{2,})s(?![a-z])/g, '$1S')
            .split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|[^A-Za-z0-9]+/)
            .map((word) => word.toLowerCase().replace(/\d+$/, ''))
            .filter(Boolean);
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
    static sanitizeConnections(connections) {
        if (!connections || typeof connections !== 'object') {
            return connections;
        }
        const sanitized = {};
        for (const [nodeId, nodeConnections] of Object.entries(connections)) {
            if (typeof nodeConnections === 'object' && nodeConnections !== null) {
                sanitized[nodeId] = {};
                for (const [connType, connArray] of Object.entries(nodeConnections)) {
                    if (Array.isArray(connArray)) {
                        sanitized[nodeId][connType] = connArray.map((conns) => {
                            if (Array.isArray(conns)) {
                                return conns.map((conn) => ({
                                    node: conn.node,
                                    type: conn.type,
                                    index: conn.index
                                }));
                            }
                            return conns;
                        });
                    }
                    else {
                        sanitized[nodeId][connType] = connArray;
                    }
                }
            }
            else {
                sanitized[nodeId] = nodeConnections;
            }
        }
        return sanitized;
    }
    static generateWorkflowHash(workflow) {
        const sanitized = this.sanitizeWorkflow(workflow);
        return sanitized.workflowHash;
    }
    static sanitizeWorkflowRaw(workflow) {
        const sanitized = JSON.parse(JSON.stringify(workflow));
        if (sanitized.nodes && Array.isArray(sanitized.nodes)) {
            sanitized.nodes = sanitized.nodes.map((node) => this.sanitizeNode(node));
        }
        if (sanitized.connections) {
            sanitized.connections = this.sanitizeConnections(sanitized.connections);
        }
        delete sanitized.settings?.errorWorkflow;
        delete sanitized.staticData;
        delete sanitized.pinData;
        delete sanitized.credentials;
        delete sanitized.sharedWorkflows;
        delete sanitized.ownedBy;
        delete sanitized.createdBy;
        delete sanitized.updatedBy;
        return sanitized;
    }
}
exports.WorkflowSanitizer = WorkflowSanitizer;
WorkflowSanitizer.SENSITIVE_PATTERNS = [
    { pattern: /https?:\/\/[^\s"'`<>(){}\[\],;]*?\/webhook(?:s|-test)?\/[^\s"'`<>(){}\[\],;]+/gi, placeholder: '[REDACTED_WEBHOOK]' },
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
    { pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, placeholder: '[REDACTED_JWT]' },
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
    { pattern: /\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, placeholder: '[REDACTED_EMAIL]' },
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
//# sourceMappingURL=workflow-sanitizer.js.map