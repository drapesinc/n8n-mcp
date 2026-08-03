"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.N8nNodeLoader = void 0;
const path_1 = __importDefault(require("path"));
const module_1 = require("module");
function createMissingDependencyStub() {
    const stub = new Proxy(class MissingOptionalDependency {
    }, {
        get(target, prop) {
            if (prop in target)
                return Reflect.get(target, prop);
            if (typeof prop === 'symbol')
                return undefined;
            return stub;
        },
        apply() {
            return stub;
        },
        construct() {
            return {};
        }
    });
    return stub;
}
class N8nNodeLoader {
    constructor() {
        this.CORE_PACKAGES = [
            { name: 'n8n-nodes-base', path: 'n8n-nodes-base' },
            { name: '@n8n/n8n-nodes-langchain', path: '@n8n/n8n-nodes-langchain' }
        ];
    }
    async loadAllNodes() {
        const results = [];
        for (const pkg of this.CORE_PACKAGES) {
            try {
                console.log(`\n📦 Loading package: ${pkg.name} from ${pkg.path}`);
                const packageJson = require(`${pkg.path}/package.json`);
                console.log(`  Found ${Object.keys(packageJson.n8n?.nodes || {}).length} nodes in package.json`);
                const nodes = await this.loadPackageNodes(pkg.name, pkg.path, packageJson);
                results.push(...nodes);
            }
            catch (error) {
                console.error(`Failed to load ${pkg.name}:`, error);
            }
        }
        return results;
    }
    resolvePackageDir(packagePath) {
        const pkgJsonPath = require.resolve(`${packagePath}/package.json`);
        return path_1.default.dirname(pkgJsonPath);
    }
    loadNodeModule(absolutePath) {
        try {
            return require(absolutePath);
        }
        catch (error) {
            if (error.code !== 'MODULE_NOT_FOUND') {
                throw error;
            }
            return this.loadNodeModuleWithStubbedDependencies(absolutePath);
        }
    }
    loadNodeModuleWithStubbedDependencies(absolutePath) {
        const moduleInternals = module_1.Module;
        const originalLoad = moduleInternals._load;
        const stubbedDependencies = new Set();
        moduleInternals._load = function (request, parent, isMain) {
            try {
                return originalLoad.call(this, request, parent, isMain);
            }
            catch (error) {
                const err = error;
                if (err.code === 'MODULE_NOT_FOUND' &&
                    request !== absolutePath &&
                    !request.startsWith('.') &&
                    !path_1.default.isAbsolute(request) &&
                    typeof err.message === 'string' &&
                    err.message.includes(`'${request}'`)) {
                    stubbedDependencies.add(request);
                    return createMissingDependencyStub();
                }
                throw error;
            }
        };
        try {
            const nodeModule = require(absolutePath);
            console.warn(`  ⚠ Loaded ${path_1.default.basename(absolutePath)} with stubbed missing dependencies: ${[...stubbedDependencies].join(', ')}`);
            return nodeModule;
        }
        finally {
            moduleInternals._load = originalLoad;
        }
    }
    resolveNodeClass(nodeModule, nodeName) {
        return (nodeModule.default ||
            nodeModule[nodeName] ||
            Object.values(nodeModule).find(exported => typeof exported === 'function'));
    }
    async loadPackageNodes(packageName, packagePath, packageJson) {
        const n8nConfig = packageJson.n8n || {};
        const nodes = [];
        const packageDir = this.resolvePackageDir(packagePath);
        const nodesList = n8nConfig.nodes || [];
        if (Array.isArray(nodesList)) {
            for (const nodePath of nodesList) {
                try {
                    const fullPath = path_1.default.join(packageDir, nodePath);
                    const nodeModule = this.loadNodeModule(fullPath);
                    const nodeNameMatch = nodePath.match(/\/([^\/]+)\.node(?:\.ee)?\.(js|ts)$/);
                    const nodeName = nodeNameMatch
                        ? nodeNameMatch[1]
                        : path_1.default.basename(nodePath).replace(/\.node(?:\.ee)?\.(js|ts)$/, '');
                    const NodeClass = this.resolveNodeClass(nodeModule, nodeName);
                    if (NodeClass) {
                        nodes.push({ packageName, nodeName, NodeClass });
                        console.log(`  ✓ Loaded ${nodeName} from ${packageName}`);
                    }
                    else {
                        console.warn(`  ⚠ No valid export found for ${nodeName} in ${packageName}`);
                    }
                }
                catch (error) {
                    console.error(`  ✗ Failed to load node from ${packageName}/${nodePath}:`, error.message);
                }
            }
        }
        else {
            for (const [nodeName, nodePath] of Object.entries(nodesList)) {
                try {
                    const fullPath = path_1.default.join(packageDir, nodePath);
                    const nodeModule = this.loadNodeModule(fullPath);
                    const NodeClass = this.resolveNodeClass(nodeModule, nodeName);
                    if (NodeClass) {
                        nodes.push({ packageName, nodeName, NodeClass });
                        console.log(`  ✓ Loaded ${nodeName} from ${packageName}`);
                    }
                    else {
                        console.warn(`  ⚠ No valid export found for ${nodeName} in ${packageName}`);
                    }
                }
                catch (error) {
                    console.error(`  ✗ Failed to load node ${nodeName} from ${packageName}:`, error.message);
                }
            }
        }
        return nodes;
    }
}
exports.N8nNodeLoader = N8nNodeLoader;
//# sourceMappingURL=node-loader.js.map