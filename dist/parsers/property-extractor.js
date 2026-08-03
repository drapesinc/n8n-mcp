"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyExtractor = void 0;
const node_types_1 = require("../types/node-types");
class PropertyExtractor {
    extractProperties(nodeClass) {
        const properties = [];
        const instance = (0, node_types_1.instantiateNode)(nodeClass);
        if (instance?.nodeVersions) {
            const versions = Object.keys(instance.nodeVersions).map(Number);
            if (versions.length > 0) {
                const latestVersion = Math.max(...versions);
                if (!isNaN(latestVersion)) {
                    const versionedNode = instance.nodeVersions[latestVersion];
                    if (versionedNode?.description?.properties) {
                        return this.normalizeProperties(versionedNode.description.properties);
                    }
                }
            }
        }
        const description = instance?.description || instance?.baseDescription ||
            this.getNodeDescription(nodeClass);
        if (description?.properties) {
            return this.normalizeProperties(description.properties);
        }
        return properties;
    }
    getNodeDescription(nodeClass) {
        if (typeof nodeClass !== 'function') {
            return nodeClass.description || {};
        }
        const instance = (0, node_types_1.instantiateNode)(nodeClass);
        return instance
            ? instance.description || instance.baseDescription || {}
            : nodeClass.description || {};
    }
    extractOperations(nodeClass) {
        const operations = [];
        const instance = (0, node_types_1.instantiateNode)(nodeClass);
        if (instance?.nodeVersions) {
            const versions = Object.keys(instance.nodeVersions).map(Number);
            if (versions.length > 0) {
                const latestVersion = Math.max(...versions);
                if (!isNaN(latestVersion)) {
                    const versionedNode = instance.nodeVersions[latestVersion];
                    if (versionedNode?.description) {
                        return this.extractOperationsFromDescription(versionedNode.description);
                    }
                }
            }
        }
        const description = instance?.description || instance?.baseDescription ||
            this.getNodeDescription(nodeClass);
        return this.extractOperationsFromDescription(description);
    }
    extractOperationsFromDescription(description) {
        const operations = [];
        if (!description)
            return operations;
        if (description.routing) {
            const routing = description.routing;
            if (routing.request?.resource) {
                const resources = routing.request.resource.options || [];
                const operationOptions = routing.request.operation?.options || {};
                resources.forEach((resource) => {
                    const resourceOps = operationOptions[resource.value] || [];
                    resourceOps.forEach((op) => {
                        operations.push({
                            resource: resource.value,
                            operation: op.value,
                            name: `${resource.name} - ${op.name}`,
                            action: op.action
                        });
                    });
                });
            }
        }
        if (description.properties && Array.isArray(description.properties)) {
            const operationProps = description.properties.filter((p) => p.name === 'operation' || p.name === 'action');
            for (const operationProp of operationProps) {
                if (!operationProp?.options)
                    continue;
                const resource = operationProp.displayOptions?.show?.resource?.[0];
                operationProp.options.forEach((op) => {
                    operations.push({
                        operation: op.value,
                        name: op.name,
                        description: op.description,
                        ...(resource ? { resource } : {})
                    });
                });
            }
        }
        return operations;
    }
    declaresToolUse(description) {
        const usableAsTool = description?.usableAsTool;
        return usableAsTool !== undefined && usableAsTool !== null && usableAsTool !== false;
    }
    detectAIToolCapability(nodeClass) {
        const instance = (0, node_types_1.instantiateNode)(nodeClass);
        const description = instance?.description || instance?.baseDescription || this.getNodeDescription(nodeClass);
        const nodeVersions = nodeClass.nodeVersions ?? instance?.nodeVersions;
        if (nodeVersions) {
            const currentVersion = instance?.currentVersion ??
                description?.defaultVersion ??
                Math.max(...Object.keys(nodeVersions).map(Number));
            const versionDescription = nodeVersions[currentVersion]?.description;
            if (versionDescription)
                return this.declaresToolUse(versionDescription);
        }
        if (this.declaresToolUse(description))
            return true;
        return description?.actions?.some((a) => this.declaresToolUse(a)) === true;
    }
    extractCredentials(nodeClass) {
        const credentials = [];
        const instance = (0, node_types_1.instantiateNode)(nodeClass);
        if (instance?.nodeVersions) {
            const versions = Object.keys(instance.nodeVersions).map(Number);
            if (versions.length > 0) {
                const latestVersion = Math.max(...versions);
                if (!isNaN(latestVersion)) {
                    const versionedNode = instance.nodeVersions[latestVersion];
                    if (versionedNode?.description?.credentials) {
                        return versionedNode.description.credentials;
                    }
                }
            }
        }
        const description = instance?.description || instance?.baseDescription ||
            this.getNodeDescription(nodeClass);
        if (description?.credentials) {
            return description.credentials;
        }
        return credentials;
    }
    normalizeProperties(properties) {
        return properties.map(prop => ({
            displayName: prop.displayName,
            name: prop.name,
            type: prop.type,
            default: prop.default,
            description: prop.description,
            options: prop.options,
            required: prop.required,
            displayOptions: prop.displayOptions,
            typeOptions: prop.typeOptions,
            modes: prop.modes,
            noDataExpression: prop.noDataExpression
        }));
    }
}
exports.PropertyExtractor = PropertyExtractor;
//# sourceMappingURL=property-extractor.js.map