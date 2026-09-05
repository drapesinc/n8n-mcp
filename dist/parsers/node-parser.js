"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeParser = void 0;
exports.normalizeNodeVersion = normalizeNodeVersion;
const property_extractor_1 = require("./property-extractor");
const node_types_1 = require("../types/node-types");
const version_display_gate_1 = require("./version-display-gate");
function normalizeNodeVersion(version) {
    const numeric = Number(version);
    return Number.isFinite(numeric) ? String(numeric) : String(version);
}
class NodeParser {
    constructor() {
        this.propertyExtractor = new property_extractor_1.PropertyExtractor();
        this.currentNodeClass = null;
    }
    parse(nodeClass, packageName) {
        this.currentNodeClass = nodeClass;
        const description = this.getNodeDescription(nodeClass);
        const outputInfo = this.extractOutputs(description);
        return {
            style: this.detectStyle(nodeClass),
            nodeType: this.extractNodeType(description, packageName),
            displayName: description.displayName || description.name,
            description: description.description,
            category: this.extractCategory(description),
            properties: this.propertyExtractor.extractProperties(nodeClass),
            credentials: this.propertyExtractor.extractCredentials(nodeClass),
            isAITool: this.propertyExtractor.detectAIToolCapability(nodeClass),
            isTrigger: this.detectTrigger(description),
            isWebhook: this.detectWebhook(description),
            operations: this.propertyExtractor.extractOperations(nodeClass),
            version: this.extractVersion(nodeClass),
            isVersioned: this.detectVersioned(nodeClass),
            packageName: packageName,
            outputs: outputInfo.outputs,
            outputNames: outputInfo.outputNames
        };
    }
    parseVersions(nodeClass, packageName) {
        this.currentNodeClass = nodeClass;
        const base = this.getNodeDescription(nodeClass);
        const nodeType = this.extractNodeType(base, packageName);
        const currentVersion = this.extractVersion(nodeClass);
        const category = this.extractCategory(base);
        const instance = (0, node_types_1.instantiateNode)(nodeClass);
        const nodeVersions = instance?.nodeVersions ?? nodeClass.nodeVersions;
        const entries = new Map();
        const record = (version, description) => {
            if (description && Number.isFinite(Number(version))) {
                entries.set(normalizeNodeVersion(version), description);
            }
        };
        if (nodeVersions && typeof nodeVersions === 'object') {
            for (const [key, implementation] of Object.entries(nodeVersions)) {
                record(key, implementation?.description);
            }
        }
        else {
            const declared = base.version;
            if (!Array.isArray(declared))
                return [];
            for (const version of declared)
                record(version, base);
        }
        const ordered = [...entries.entries()].sort(([a], [b]) => Number(a) - Number(b));
        let previousNames = null;
        return ordered.map(([version, description]) => {
            const details = this.propertyExtractor.extractVersionDetails(description);
            details.properties = (0, version_display_gate_1.filterPropertiesForVersion)(details.properties, version);
            const names = new Set(details.properties.map((p) => p.name).filter((n) => typeof n === 'string'));
            const previous = previousNames;
            const addedProperties = previous ? [...names].filter(n => !previous.has(n)) : [];
            const deprecatedProperties = previous ? [...previous].filter(n => !names.has(n)) : [];
            previousNames = names;
            return {
                nodeType,
                version,
                packageName,
                displayName: description.displayName || base.displayName || base.name,
                description: description.description ?? base.description,
                category,
                isCurrentMax: version === currentVersion,
                properties: details.properties,
                operations: details.operations,
                credentials: details.credentials,
                outputs: this.extractOutputs(description).outputs,
                addedProperties,
                deprecatedProperties
            };
        });
    }
    getNodeDescription(nodeClass) {
        let description;
        if ((0, node_types_1.isVersionedNodeClass)(nodeClass)) {
            try {
                const instance = new nodeClass();
                const inst = instance;
                description = inst.description || (inst.nodeVersions ? inst.baseDescription : undefined);
            }
            catch (e) {
            }
        }
        else if (typeof nodeClass === 'function') {
            try {
                const instance = new nodeClass();
                description = instance.description;
                if (!description || !description.name) {
                    const inst = instance;
                    if (inst.baseDescription?.name) {
                        description = inst.baseDescription;
                    }
                }
            }
            catch (e) {
                description = nodeClass.description;
            }
        }
        else {
            description = nodeClass.description;
            if (!description || !description.name) {
                const inst = nodeClass;
                if (inst.baseDescription?.name) {
                    description = inst.baseDescription;
                }
            }
        }
        return description || {};
    }
    detectStyle(nodeClass) {
        const desc = this.getNodeDescription(nodeClass);
        return desc.routing ? 'declarative' : 'programmatic';
    }
    extractNodeType(description, packageName) {
        const name = description.name;
        if (!name) {
            throw new Error('Node is missing name property');
        }
        if (name.includes('.')) {
            return name;
        }
        const packagePrefix = packageName.replace('@n8n/', '').replace('n8n-', '');
        return `${packagePrefix}.${name}`;
    }
    extractCategory(description) {
        return description.group?.[0] ||
            description.categories?.[0] ||
            description.category ||
            'misc';
    }
    detectTrigger(description) {
        const desc = description;
        if (description.group && Array.isArray(description.group)) {
            if (description.group.includes('trigger')) {
                return true;
            }
        }
        return desc.polling === true ||
            desc.trigger === true ||
            desc.eventTrigger === true ||
            description.name?.toLowerCase().includes('trigger');
    }
    detectWebhook(description) {
        const desc = description;
        return (desc.webhooks?.length > 0) ||
            desc.webhook === true ||
            description.name?.toLowerCase().includes('webhook');
    }
    extractVersion(nodeClass) {
        try {
            const instance = typeof nodeClass === 'function' ? new nodeClass() : nodeClass;
            const inst = instance;
            if (inst?.currentVersion !== undefined) {
                return inst.currentVersion.toString();
            }
            if (inst?.description?.defaultVersion) {
                return inst.description.defaultVersion.toString();
            }
            if (inst?.nodeVersions) {
                const versions = Object.keys(inst.nodeVersions).map(Number);
                if (versions.length > 0) {
                    const maxVersion = Math.max(...versions);
                    if (!isNaN(maxVersion)) {
                        return maxVersion.toString();
                    }
                }
            }
            if (inst?.description?.version) {
                const version = inst.description.version;
                if (Array.isArray(version)) {
                    const numericVersions = version.map((v) => parseFloat(v.toString()));
                    if (numericVersions.length > 0) {
                        const maxVersion = Math.max(...numericVersions);
                        if (!isNaN(maxVersion)) {
                            return maxVersion.toString();
                        }
                    }
                }
                else if (typeof version === 'number' || typeof version === 'string') {
                    return version.toString();
                }
            }
        }
        catch (e) {
        }
        const nodeClassAny = nodeClass;
        if (nodeClassAny.description?.defaultVersion) {
            return nodeClassAny.description.defaultVersion.toString();
        }
        if (nodeClassAny.nodeVersions) {
            const versions = Object.keys(nodeClassAny.nodeVersions).map(Number);
            if (versions.length > 0) {
                const maxVersion = Math.max(...versions);
                if (!isNaN(maxVersion)) {
                    return maxVersion.toString();
                }
            }
        }
        const description = this.getNodeDescription(nodeClass);
        const desc = description;
        if (desc?.version) {
            if (Array.isArray(desc.version)) {
                const numericVersions = desc.version.map((v) => parseFloat(v.toString()));
                if (numericVersions.length > 0) {
                    const maxVersion = Math.max(...numericVersions);
                    if (!isNaN(maxVersion)) {
                        return maxVersion.toString();
                    }
                }
            }
            else if (typeof desc.version === 'number' || typeof desc.version === 'string') {
                return desc.version.toString();
            }
        }
        return '1';
    }
    detectVersioned(nodeClass) {
        try {
            const instance = typeof nodeClass === 'function' ? new nodeClass() : nodeClass;
            const inst = instance;
            if (inst?.baseDescription?.defaultVersion) {
                return true;
            }
            if (inst?.nodeVersions) {
                return true;
            }
            if (inst?.description?.version && Array.isArray(inst.description.version)) {
                return true;
            }
        }
        catch (e) {
        }
        const nodeClassAny = nodeClass;
        if (nodeClassAny.nodeVersions || nodeClassAny.baseDescription?.defaultVersion) {
            return true;
        }
        const description = this.getNodeDescription(nodeClass);
        const desc = description;
        if (desc?.version && Array.isArray(desc.version)) {
            return true;
        }
        return false;
    }
    extractOutputs(description) {
        const result = {};
        const desc = description;
        if (desc.outputs) {
            result.outputs = Array.isArray(desc.outputs) ? desc.outputs : [desc.outputs];
        }
        if (desc.outputNames) {
            result.outputNames = Array.isArray(desc.outputNames) ? desc.outputNames : [desc.outputNames];
        }
        if (!result.outputs && !result.outputNames) {
            const nodeClass = this.currentNodeClass;
            if (nodeClass) {
                try {
                    const instance = typeof nodeClass === 'function' ? new nodeClass() : nodeClass;
                    const inst = instance;
                    if (inst.nodeVersions) {
                        const versions = Object.keys(inst.nodeVersions).map(Number);
                        if (versions.length > 0) {
                            const latestVersion = Math.max(...versions);
                            if (!isNaN(latestVersion)) {
                                const versionedDescription = inst.nodeVersions[latestVersion]?.description;
                                if (versionedDescription) {
                                    if (versionedDescription.outputs) {
                                        result.outputs = Array.isArray(versionedDescription.outputs)
                                            ? versionedDescription.outputs
                                            : [versionedDescription.outputs];
                                    }
                                    if (versionedDescription.outputNames) {
                                        result.outputNames = Array.isArray(versionedDescription.outputNames)
                                            ? versionedDescription.outputNames
                                            : [versionedDescription.outputNames];
                                    }
                                }
                            }
                        }
                    }
                }
                catch (e) {
                }
            }
        }
        return result;
    }
}
exports.NodeParser = NodeParser;
//# sourceMappingURL=node-parser.js.map