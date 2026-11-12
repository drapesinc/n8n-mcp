"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyFilter = void 0;
const version_display_gate_1 = require("../parsers/version-display-gate");
const typeversion_1 = require("../utils/typeversion");
const APPLIES_WHEN = Symbol('appliesWhen');
class PropertyFilter {
    static deduplicateProperties(properties) {
        const seen = new Map();
        return properties.filter(prop => {
            if (!prop || !prop.name) {
                return false;
            }
            const conditions = JSON.stringify(prop.displayOptions || {});
            const key = `${prop.name}_${conditions}`;
            if (seen.has(key)) {
                return false;
            }
            seen.set(key, prop);
            return true;
        });
    }
    static getEssentials(allProperties, nodeType, version) {
        if (!allProperties) {
            return { required: [], common: [] };
        }
        const numericVersion = (0, typeversion_1.parseTypeVersion)(version);
        const versioned = numericVersion === null
            ? allProperties
            : this.resolveVersionGates(allProperties, numericVersion);
        const uniqueProperties = this.mergeOptionsCollections(this.deduplicateProperties(versioned));
        const config = this.ESSENTIAL_PROPERTIES[nodeType];
        if (!config) {
            return this.inferEssentials(uniqueProperties);
        }
        const required = this.extractProperties(uniqueProperties, config.required, true);
        const requiredNames = new Set(required.map(p => p.name));
        const common = this.extractProperties(uniqueProperties, config.common, false)
            .filter(p => !requiredNames.has(p.name));
        return { required, common };
    }
    static resolveVersionGates(properties, version) {
        return (0, version_display_gate_1.filterPropertiesForVersion)(properties, version).map(prop => {
            const display = prop?.displayOptions;
            if (!display || (display.show?.['@version'] === undefined && display.hide?.['@version'] === undefined)) {
                return prop;
            }
            const strip = (conditions) => {
                if (!conditions)
                    return undefined;
                const { '@version': _resolved, ...rest } = conditions;
                return Object.keys(rest).length > 0 ? rest : undefined;
            };
            const show = strip(display.show);
            const hide = strip(display.hide);
            const displayOptions = show || hide ? { ...(show && { show }), ...(hide && { hide }) } : undefined;
            return { ...prop, displayOptions };
        });
    }
    static mergeOptionsCollections(properties) {
        const isOptionsCollection = (prop) => prop?.type === 'collection' && prop.name === 'options';
        const collections = properties.filter(prop => isOptionsCollection(prop) && Array.isArray(prop.options));
        if (collections.length < 2)
            return properties;
        const first = properties.find(isOptionsCollection);
        const conditions = JSON.stringify(first.displayOptions ?? null);
        const shared = collections.every(c => JSON.stringify(c.displayOptions ?? null) === conditions);
        const byName = new Map();
        for (const collection of collections) {
            for (const child of collection.options) {
                if (!child?.name)
                    continue;
                const key = this.variantKey(child);
                const entry = byName.get(key) ?? { child, parents: new Set() };
                entry.parents.add(collection);
                byName.set(key, entry);
            }
        }
        const children = [...byName.values()].map(({ child, parents }) => {
            if (shared || parents.size === collections.length)
                return child;
            const appliesWhen = this.describeConditions([...parents].map(parent => parent.displayOptions));
            return appliesWhen ? { ...child, [APPLIES_WHEN]: appliesWhen } : child;
        });
        const merged = { ...first, options: children, displayOptions: shared ? first.displayOptions : undefined };
        return properties.flatMap(prop => {
            if (!isOptionsCollection(prop))
                return [prop];
            return prop === first ? [merged] : [];
        });
    }
    static describeConditions(rules) {
        const parsed = rules.map(rule => ({
            show: this.withoutVersionGate(rule?.show),
            hide: this.withoutVersionGate(rule?.hide)
        }));
        if (parsed.some(rule => Object.keys(rule.show).length === 0 && Object.keys(rule.hide).length === 0)) {
            return undefined;
        }
        const key = (show) => Object.keys(show).sort().join(',');
        const differingFields = Object.keys(parsed[0].show).filter(name => new Set(parsed.map(rule => JSON.stringify([...new Set((rule.show[name] ?? []).map(String))].sort()))).size > 1);
        const foldable = differingFields.length <= 1 && parsed.every(rule => Object.keys(rule.hide).length === 0 &&
            key(rule.show) === key(parsed[0].show) &&
            Object.values(rule.show).flat().every(value => !this.isOperatorCondition(value)));
        if (foldable) {
            const folded = {};
            for (const { show } of parsed) {
                for (const [name, values] of Object.entries(show))
                    folded[name] = (folded[name] ?? []).concat(values);
            }
            return this.describeRule(folded, {});
        }
        return parsed.map(rule => this.describeRule(rule.show, rule.hide)).join(' or ');
    }
    static withoutVersionGate(conditions) {
        if (!conditions || typeof conditions !== 'object')
            return {};
        const { '@version': _gate, ...rest } = conditions;
        return Object.fromEntries(Object.entries(rest).map(([name, values]) => [name, [].concat(values)]));
    }
    static describeRule(show, hide) {
        const shown = Object.keys(show).sort().map(name => this.describeField(name, show[name]));
        const hidden = Object.keys(hide).sort().map(name => `not ${this.describeField(name, hide[name])}`);
        return [...shown, ...hidden].join(' & ');
    }
    static describeField(rawName, values) {
        const name = rawName.replace(/^\//, '');
        const plain = [...new Set(values
                .filter(value => !this.isOperatorCondition(value))
                .map(value => (value === '' ? '""' : String(value))))];
        const parts = plain.length > 0 ? [`${name}=${plain.join('|')}`] : [];
        for (const value of values) {
            if (this.isOperatorCondition(value))
                parts.push(this.describeOperator(name, value._cnd));
        }
        return parts.length > 1 ? `(${parts.join(' or ')})` : parts[0] ?? name;
    }
    static isOperatorCondition(value) {
        return typeof value === 'object' && value !== null && '_cnd' in value;
    }
    static describeOperator(name, condition) {
        const [operator, target] = Object.entries(condition ?? {})[0] ?? [];
        switch (operator) {
            case 'exists': return `${name} is set`;
            case 'eq': return `${name}=${target}`;
            case 'not': return `${name}!=${target}`;
            case 'gte': return `${name}>=${target}`;
            case 'lte': return `${name}<=${target}`;
            case 'gt': return `${name}>${target}`;
            case 'lt': return `${name}<${target}`;
            case 'between': return `${name} between ${target?.from} and ${target?.to}`;
            case 'startsWith': return `${name} starts with ${target}`;
            case 'endsWith': return `${name} ends with ${target}`;
            case 'includes': return `${name} contains ${target}`;
            case 'regex': return `${name} matches ${target}`;
            default: return `${name} ${operator ?? 'condition'} ${JSON.stringify(target)}`;
        }
    }
    static extractProperties(allProperties, propertyNames, markAsRequired) {
        const extracted = [];
        for (const name of propertyNames) {
            const property = this.findPropertyByName(allProperties, name);
            if (property) {
                const simplified = this.simplifyProperty(property);
                if (markAsRequired) {
                    simplified.required = true;
                }
                extracted.push(simplified);
            }
        }
        return extracted;
    }
    static findPropertyByName(properties, name) {
        for (const prop of properties) {
            if (prop.name === name) {
                return prop;
            }
            if (prop.type === 'collection' && prop.options) {
                const found = this.findPropertyByName(prop.options, name);
                if (found)
                    return found;
            }
            if (prop.type === 'fixedCollection' && prop.options) {
                for (const option of prop.options) {
                    if (option.values) {
                        const found = this.findPropertyByName(option.values, name);
                        if (found)
                            return found;
                    }
                }
            }
        }
        return undefined;
    }
    static simplifyProperty(prop) {
        const simplified = {
            name: prop.name,
            displayName: prop.displayName || prop.name,
            type: prop.type || 'string',
            description: this.extractDescription(prop),
            required: prop.required || false
        };
        if (prop.default !== undefined &&
            typeof prop.default !== 'object' ||
            prop.type === 'options' ||
            prop.type === 'multiOptions') {
            simplified.default = prop.default;
        }
        if (prop.placeholder) {
            simplified.placeholder = prop.placeholder;
        }
        let truncationNote;
        if ((prop.type === 'collection' || prop.type === 'fixedCollection') && Array.isArray(prop.options)) {
            simplified.options = this.summarizeChildren(prop);
            const total = this.uniqueVariants(prop.options).length;
            if (total > simplified.options.length) {
                truncationNote = `Lists ${simplified.options.length} of ${total} settings. ` +
                    'get_node with mode "search_properties" or detail "full" shows the rest.';
            }
        }
        else if (prop.options && Array.isArray(prop.options)) {
            const limitedOptions = prop.options.slice(0, 20);
            simplified.options = limitedOptions.map((opt) => {
                if (typeof opt === 'string') {
                    return { value: opt, label: opt };
                }
                return {
                    value: opt.value || opt.name,
                    label: opt.name || opt.value || opt.displayName
                };
            });
        }
        if (prop.type === 'resourceLocator' || prop.type === 'agentSelector') {
            const modes = prop.modes?.map((m) => m.name || m) || ['list', 'id'];
            const defaultValue = prop.default?.value || 'your-resource-id';
            simplified.expectedFormat = {
                structure: { mode: 'string', value: 'string' },
                modes,
                example: { mode: 'id', value: defaultValue }
            };
        }
        if (prop.displayOptions?.show) {
            const conditions = Object.keys(prop.displayOptions.show);
            if (conditions.length <= 2) {
                simplified.showWhen = prop.displayOptions.show;
            }
        }
        const dynamic = PropertyFilter.extractDynamicOptions(prop);
        if (dynamic)
            simplified.dynamicOptions = dynamic;
        simplified.usageHint = truncationNote ?? this.generateUsageHint(prop);
        return simplified;
    }
    static summarizeChildren(prop) {
        return this.uniqueVariants(prop.options)
            .slice(0, this.MAX_CHILD_SETTINGS)
            .map((child) => {
            const line = this.oneLine(child);
            return {
                value: String(child.name),
                label: String(child.displayName || child.name),
                ...(line && { description: line })
            };
        });
    }
    static oneLine(setting) {
        const parts = [];
        const text = this.firstSentence(setting.description || setting.hint);
        if (text)
            parts.push(/[.!?…]$/.test(text) ? text : `${text}.`);
        const nested = this.nestedFields(setting);
        if (nested.length > 0) {
            const shown = nested.slice(0, this.MAX_NESTED_NAMES).map(field => this.fieldLabel(field));
            parts.push(`Fields: ${shown.join(', ')}${nested.length > shown.length ? ', …' : ''}.`);
        }
        const values = this.choiceValues(setting);
        if (values)
            parts.push(`Values: ${values}.`);
        const conditions = [this.describeConditions([setting.displayOptions]), setting[APPLIES_WHEN]].filter(Boolean);
        if (conditions.length > 0)
            parts.push(`Only when ${conditions.join(' and ')}.`);
        return parts.join(' ');
    }
    static nestedFields(setting) {
        let fields = [];
        if (Array.isArray(setting.values)) {
            fields = setting.values;
        }
        else if (setting.type === 'collection' && Array.isArray(setting.options)) {
            fields = setting.options;
        }
        else if (setting.type === 'fixedCollection' && Array.isArray(setting.options)) {
            fields = setting.options.flatMap((group) => Array.isArray(group?.values) ? group.values : []);
        }
        return this.uniqueByName(fields.filter(field => field?.type !== 'notice'));
    }
    static variantKey(item) {
        const { description: _description, hint: _hint, placeholder: _placeholder, displayName: _displayName, ...shape } = item;
        const seen = new WeakSet();
        return JSON.stringify(shape, (_key, value) => {
            if (typeof value !== 'object' || value === null)
                return value;
            if (seen.has(value))
                return '[seen]';
            seen.add(value);
            return value;
        });
    }
    static uniqueVariants(items) {
        const seen = new Set();
        return items.filter(item => {
            if (!item?.name)
                return false;
            const key = this.variantKey(item);
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    static uniqueByName(items) {
        const seen = new Set();
        return items.filter(item => {
            if (!item?.name || seen.has(item.name))
                return false;
            seen.add(item.name);
            return true;
        });
    }
    static fieldLabel(field) {
        const values = this.choiceValues(field);
        return values ? `${field.name} (${values})` : String(field.name);
    }
    static choiceValues(field) {
        if ((field.type !== 'options' && field.type !== 'multiOptions') || !Array.isArray(field.options))
            return undefined;
        const values = field.options
            .map((option) => (typeof option === 'object' && option !== null ? option.value ?? option.name : option))
            .filter((value) => value !== undefined && value !== null && value !== '')
            .map((value) => {
            const text = String(value);
            return /^[\w.@/:-]+$/.test(text) ? text : JSON.stringify(text);
        });
        if (values.length === 0)
            return undefined;
        const shown = values.slice(0, this.MAX_INLINE_VALUES);
        return shown.join('|') + (values.length > shown.length ? '|…' : '');
    }
    static firstSentence(text) {
        if (typeof text !== 'string')
            return '';
        let stripped = text;
        let previous;
        do {
            previous = stripped;
            stripped = stripped.replace(/<[^<>]*>/g, '');
        } while (stripped !== previous);
        const plain = stripped.replace(/\s+/g, ' ').trim();
        if (!plain)
            return '';
        const sentence = plain.match(/^.*?(?<!\b(?:e\.g|i\.e|etc|vs|approx|incl))[.!?](?=\s|$)/i)?.[0] ?? plain;
        return sentence.length > this.MAX_LINE_DESCRIPTION
            ? `${sentence.slice(0, this.MAX_LINE_DESCRIPTION - 1).trimEnd()}…`
            : sentence;
    }
    static extractDynamicOptions(prop) {
        const dependsOn = (o) => Array.isArray(o?.loadOptionsDependsOn) ? o.loadOptionsDependsOn.map(String) : [];
        const method = prop?.typeOptions?.loadOptionsMethod;
        if (typeof method === 'string' && method) {
            return { methodName: method, methodType: 'loadOptions', dependsOn: dependsOn(prop.typeOptions) };
        }
        if (Array.isArray(prop?.modes)) {
            const mode = prop.modes.find((m) => typeof m?.typeOptions?.searchListMethod === 'string');
            if (mode) {
                return {
                    methodName: mode.typeOptions.searchListMethod,
                    methodType: 'listSearch',
                    dependsOn: [...new Set([...dependsOn(prop.typeOptions), ...dependsOn(mode.typeOptions)])]
                };
            }
        }
        return undefined;
    }
    static generateUsageHint(prop) {
        if (prop.name.toLowerCase().includes('url') || prop.name === 'endpoint') {
            return 'Enter the full URL including https://';
        }
        if (prop.name.includes('auth') || prop.name.includes('credential')) {
            return 'Select authentication method or credentials';
        }
        if (prop.type === 'json' || prop.name.includes('json')) {
            return 'Enter valid JSON data';
        }
        if (prop.type === 'code' || prop.name.includes('code')) {
            return 'Enter your code here';
        }
        if (prop.type === 'boolean' && prop.displayOptions) {
            return 'Enabling this will show additional options';
        }
        return undefined;
    }
    static extractDescription(prop) {
        const description = prop.description ||
            prop.hint ||
            prop.placeholder ||
            prop.displayName ||
            '';
        if (!description) {
            return this.generateDescription(prop);
        }
        return description;
    }
    static generateDescription(prop) {
        const name = prop.name.toLowerCase();
        const type = prop.type;
        const commonDescriptions = {
            'url': 'The URL to make the request to',
            'method': 'HTTP method to use for the request',
            'authentication': 'Authentication method to use',
            'sendbody': 'Whether to send a request body',
            'contenttype': 'Content type of the request body',
            'sendheaders': 'Whether to send custom headers',
            'jsonbody': 'JSON data to send in the request body',
            'headers': 'Custom headers to send with the request',
            'timeout': 'Request timeout in milliseconds',
            'query': 'SQL query to execute',
            'table': 'Database table name',
            'operation': 'Operation to perform',
            'path': 'Webhook path or file path',
            'httpmethod': 'HTTP method to accept',
            'responsemode': 'How to respond to the webhook',
            'responsecode': 'HTTP response code to return',
            'channel': 'Slack channel to send message to',
            'text': 'Text content of the message',
            'subject': 'Email subject line',
            'fromemail': 'Sender email address',
            'toemail': 'Recipient email address',
            'language': 'Programming language to use',
            'jscode': 'JavaScript code to execute',
            'pythoncode': 'Python code to execute'
        };
        if (commonDescriptions[name]) {
            return commonDescriptions[name];
        }
        for (const [key, desc] of Object.entries(commonDescriptions)) {
            if (name.includes(key)) {
                return desc;
            }
        }
        if (type === 'boolean') {
            return `Enable or disable ${prop.displayName || name}`;
        }
        else if (type === 'options') {
            return `Select ${prop.displayName || name}`;
        }
        else if (type === 'string') {
            return `Enter ${prop.displayName || name}`;
        }
        else if (type === 'number') {
            return `Number value for ${prop.displayName || name}`;
        }
        else if (type === 'json') {
            return `JSON data for ${prop.displayName || name}`;
        }
        return `Configure ${prop.displayName || name}`;
    }
    static inferEssentials(properties) {
        const required = properties
            .filter(p => p.name && p.required === true)
            .slice(0, 10)
            .map(p => this.simplifyProperty(p));
        const common = properties
            .filter(p => {
            return p.name &&
                !p.required &&
                !p.displayOptions &&
                p.type !== 'hidden' &&
                p.type !== 'notice' &&
                !p.name.startsWith('options') &&
                !p.name.startsWith('_');
        })
            .slice(0, 10)
            .map(p => this.simplifyProperty(p));
        if (required.length + common.length < 10) {
            const additional = properties
                .filter(p => {
                return p.name &&
                    !p.required &&
                    p.type !== 'hidden' &&
                    p.type !== 'notice' &&
                    !p.name.startsWith('options') &&
                    p.displayOptions &&
                    Object.keys(p.displayOptions.show || {}).length === 1;
            })
                .slice(0, 10 - (required.length + common.length))
                .map(p => this.simplifyProperty(p));
            common.push(...additional);
        }
        const optionsCollection = properties.find(p => p.name === 'options' && p.type === 'collection');
        const isResourceBased = properties.some(p => p.name === 'resource');
        if (optionsCollection && !isResourceBased) {
            common.push(this.simplifyProperty(optionsCollection));
        }
        const totalLimit = 30;
        if (required.length + common.length > totalLimit) {
            const requiredCount = Math.min(required.length, 15);
            const commonCount = totalLimit - requiredCount;
            return {
                required: required.slice(0, requiredCount),
                common: common.slice(0, commonCount)
            };
        }
        return { required, common };
    }
    static searchProperties(allProperties, query, maxResults = 20) {
        if (!query || query.trim() === '') {
            return [];
        }
        const lowerQuery = query.toLowerCase();
        const matches = [];
        this.searchPropertiesRecursive(allProperties, lowerQuery, matches);
        return matches
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map(match => ({
            ...this.simplifyProperty(match.property),
            path: match.path
        }));
    }
    static searchPropertiesRecursive(properties, query, matches, path = '') {
        for (const prop of properties) {
            const currentPath = path ? `${path}.${prop.name}` : prop.name;
            let score = 0;
            if (prop.name.toLowerCase() === query) {
                score = 10;
            }
            else if (prop.name.toLowerCase().startsWith(query)) {
                score = 8;
            }
            else if (prop.name.toLowerCase().includes(query)) {
                score = 5;
            }
            if (prop.displayName?.toLowerCase().includes(query)) {
                score = Math.max(score, 4);
            }
            if (prop.description?.toLowerCase().includes(query)) {
                score = Math.max(score, 3);
            }
            if (score > 0) {
                matches.push({ property: prop, score, path: currentPath });
            }
            if (prop.type === 'collection' && prop.options) {
                this.searchPropertiesRecursive(prop.options, query, matches, currentPath);
            }
            else if (prop.type === 'fixedCollection' && prop.options) {
                for (const option of prop.options) {
                    if (option.values) {
                        this.searchPropertiesRecursive(option.values, query, matches, `${currentPath}.${option.name}`);
                    }
                }
            }
        }
    }
}
exports.PropertyFilter = PropertyFilter;
PropertyFilter.ESSENTIAL_PROPERTIES = {
    'nodes-base.httpRequest': {
        required: ['url'],
        common: ['method', 'authentication', 'sendQuery', 'sendHeaders', 'sendBody', 'contentType', 'specifyBody', 'jsonBody', 'options'],
        categoryPriority: ['basic', 'authentication', 'request', 'response', 'advanced']
    },
    'nodes-base.webhook': {
        required: [],
        common: ['httpMethod', 'path', 'authentication', 'responseMode', 'responseData', 'options'],
        categoryPriority: ['basic', 'response', 'advanced']
    },
    'nodes-base.code': {
        required: [],
        common: ['language', 'jsCode', 'pythonCode', 'mode'],
        categoryPriority: ['basic', 'code', 'advanced']
    },
    'nodes-base.set': {
        required: [],
        common: ['mode', 'assignments', 'jsonOutput', 'includeOtherFields', 'include', 'options'],
        categoryPriority: ['basic', 'data', 'advanced']
    },
    'nodes-base.if': {
        required: [],
        common: ['conditions', 'looseTypeValidation', 'options'],
        categoryPriority: ['basic', 'conditions', 'advanced']
    },
    'nodes-base.postgres': {
        required: [],
        common: ['operation', 'schema', 'table', 'query', 'columns', 'where', 'returnAll', 'options'],
        categoryPriority: ['basic', 'query', 'options', 'advanced']
    },
    'nodes-base.openAi': {
        required: [],
        common: ['resource', 'operation', 'chatModel', 'model', 'prompt', 'options'],
        categoryPriority: ['basic', 'model', 'input', 'options', 'advanced']
    },
    'nodes-base.googleSheets': {
        required: [],
        common: ['operation', 'documentId', 'sheetName', 'columns', 'filtersUI', 'options'],
        categoryPriority: ['basic', 'location', 'data', 'options', 'advanced']
    },
    'nodes-base.slack': {
        required: [],
        common: ['resource', 'operation', 'channelId', 'text', 'attachments', 'blocksUi'],
        categoryPriority: ['basic', 'message', 'formatting', 'advanced']
    },
    'nodes-base.emailSend': {
        required: [],
        common: ['operation', 'fromEmail', 'toEmail', 'subject', 'emailFormat', 'text', 'html', 'options'],
        categoryPriority: ['basic', 'recipients', 'content', 'advanced']
    },
    'nodes-base.merge': {
        required: [],
        common: ['mode', 'combineBy', 'fieldsToMatchString', 'joinMode', 'outputDataFrom', 'numberInputs', 'options'],
        categoryPriority: ['basic', 'merge', 'advanced']
    },
    'nodes-base.function': {
        required: [],
        common: ['functionCode'],
        categoryPriority: ['basic', 'code', 'advanced']
    },
    'nodes-base.splitInBatches': {
        required: [],
        common: ['batchSize', 'options'],
        categoryPriority: ['basic', 'options', 'advanced']
    },
    'nodes-base.redis': {
        required: [],
        common: ['operation', 'key', 'value', 'keyType', 'expire'],
        categoryPriority: ['basic', 'data', 'options', 'advanced']
    },
    'nodes-base.mongoDb': {
        required: [],
        common: ['operation', 'collection', 'query', 'fields', 'limit'],
        categoryPriority: ['basic', 'query', 'options', 'advanced']
    },
    'nodes-base.mySql': {
        required: [],
        common: ['operation', 'table', 'query', 'dataMode', 'valuesToSend', 'where', 'options'],
        categoryPriority: ['basic', 'query', 'options', 'advanced']
    },
    'nodes-base.ftp': {
        required: [],
        common: ['protocol', 'operation', 'path', 'binaryData', 'binaryPropertyName', 'options'],
        categoryPriority: ['basic', 'file', 'options', 'advanced']
    },
    'nodes-base.ssh': {
        required: [],
        common: ['resource', 'operation', 'command', 'path', 'cwd'],
        categoryPriority: ['basic', 'command', 'options', 'advanced']
    },
    'nodes-base.executeCommand': {
        required: [],
        common: ['command', 'executeOnce'],
        categoryPriority: ['basic', 'advanced']
    },
    'nodes-base.github': {
        required: [],
        common: ['resource', 'operation', 'owner', 'repository', 'title', 'body'],
        categoryPriority: ['basic', 'repository', 'content', 'advanced']
    }
};
PropertyFilter.MAX_CHILD_SETTINGS = 25;
PropertyFilter.MAX_NESTED_NAMES = 12;
PropertyFilter.MAX_INLINE_VALUES = 8;
PropertyFilter.MAX_LINE_DESCRIPTION = 120;
//# sourceMappingURL=property-filter.js.map