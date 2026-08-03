"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunityNodeService = void 0;
const logger_1 = require("../utils/logger");
const typeversion_1 = require("../utils/typeversion");
const community_node_fetcher_1 = require("./community-node-fetcher");
const NPM_MANIFEST_FETCH = { maxRetries: 1, timeout: 5000 };
const MAX_NODES_PER_PACKAGE = 100;
function extractNodeNameFromEntryPath(entryPath) {
    const match = /([^\\/]+)\.node\.(?:js|ts)$/.exec(entryPath);
    if (!match) {
        return undefined;
    }
    const className = match[1];
    const acronym = /^[A-Z]+(?=[A-Z][a-z])/.exec(className);
    if (acronym) {
        return acronym[0].toLowerCase() + className.slice(acronym[0].length);
    }
    return className.charAt(0).toLowerCase() + className.slice(1);
}
class CommunityNodeService {
    constructor(repository, environment = 'production') {
        this.repository = repository;
        this.fetcher = new community_node_fetcher_1.CommunityNodeFetcher(environment);
    }
    async syncCommunityNodes(options = {}, progressCallback) {
        const startTime = Date.now();
        const result = {
            verified: { fetched: 0, saved: 0, skipped: 0, errors: [] },
            npm: { fetched: 0, saved: 0, skipped: 0, nodesSaved: 0, nodesRemoved: 0, errors: [] },
            duration: 0,
        };
        logger_1.logger.info('Syncing verified community nodes from Strapi API...');
        try {
            result.verified = await this.syncVerifiedNodes(progressCallback, options.skipExisting);
        }
        catch (error) {
            logger_1.logger.error('Failed to sync verified nodes:', error);
            result.verified.errors.push(`Strapi sync failed: ${error.message}`);
        }
        if (!options.verifiedOnly) {
            const npmLimit = options.npmLimit ?? 100;
            logger_1.logger.info(`Syncing top ${npmLimit} npm community packages...`);
            try {
                result.npm = await this.syncNpmNodes(npmLimit, progressCallback, options.skipExisting);
            }
            catch (error) {
                logger_1.logger.error('Failed to sync npm nodes:', error);
                result.npm.errors.push(`npm sync failed: ${error.message}`);
            }
        }
        result.duration = Date.now() - startTime;
        logger_1.logger.info(`Community node sync complete in ${(result.duration / 1000).toFixed(1)}s: ` +
            `${result.verified.saved} verified, ` +
            `${result.npm.nodesSaved} npm node(s) from ${result.npm.saved} package(s)`);
        return result;
    }
    async syncVerifiedNodes(progressCallback, skipExisting) {
        const result = { fetched: 0, saved: 0, skipped: 0, errors: [] };
        const strapiNodes = await this.fetcher.fetchVerifiedNodes(progressCallback);
        result.fetched = strapiNodes.length;
        if (strapiNodes.length === 0) {
            logger_1.logger.warn('No verified nodes returned from Strapi API');
            return result;
        }
        logger_1.logger.info(`Processing ${strapiNodes.length} verified community nodes...`);
        for (const strapiNode of strapiNodes) {
            try {
                const { attributes } = strapiNode;
                if (skipExisting && this.repository.hasNodeByNpmPackage(attributes.packageName)) {
                    result.skipped++;
                    continue;
                }
                const parsedNode = this.strapiNodeToParsedNode(strapiNode);
                if (!parsedNode) {
                    result.errors.push(`Failed to parse: ${attributes.packageName}`);
                    continue;
                }
                this.repository.saveNode(parsedNode);
                result.saved++;
                if (progressCallback) {
                    progressCallback(`Saving verified nodes`, result.saved + result.skipped, strapiNodes.length);
                }
            }
            catch (error) {
                result.errors.push(`Error saving ${strapiNode.attributes.packageName}: ${error.message}`);
            }
        }
        logger_1.logger.info(`Verified nodes: ${result.saved} saved, ${result.skipped} skipped`);
        return result;
    }
    async syncNpmNodes(limit = 100, progressCallback, skipExisting) {
        const result = {
            fetched: 0,
            saved: 0,
            skipped: 0,
            nodesSaved: 0,
            nodesRemoved: 0,
            errors: [],
        };
        const npmPackages = await this.fetcher.fetchNpmPackages(limit, progressCallback);
        result.fetched = npmPackages.length;
        if (npmPackages.length === 0) {
            logger_1.logger.warn('No npm packages returned from registry');
            return result;
        }
        const verifiedPackages = new Set(this.repository
            .getCommunityNodes({ verified: true })
            .map((n) => n.npmPackageName)
            .filter(Boolean));
        logger_1.logger.info(`Processing ${npmPackages.length} npm packages (skipping ${verifiedPackages.size} verified)...`);
        for (const pkg of npmPackages) {
            try {
                const packageName = pkg.package.name;
                if (verifiedPackages.has(packageName)) {
                    result.skipped++;
                    continue;
                }
                const existingRows = this.repository.getNodesByNpmPackage(packageName);
                const resolved = await this.resolveNpmNodeNames(packageName, pkg.package.version);
                if (resolved.source === 'unavailable' && existingRows.length > 0) {
                    logger_1.logger.warn(`Skipping ${packageName}: package.json unavailable, keeping ${existingRows.length} stored row(s)`);
                    result.skipped++;
                    continue;
                }
                const parsedNodes = this.npmPackageToParsedNodes(pkg, resolved);
                const nodeTypes = parsedNodes.map((node) => node.nodeType);
                const staleRows = this.staleCommunityRows(existingRows, nodeTypes);
                const upToDate = existingRows.length > 0 && !this.rowsOutOfSync(existingRows, nodeTypes, staleRows);
                if (skipExisting && upToDate) {
                    result.skipped++;
                    continue;
                }
                const removed = this.repository.transaction(() => {
                    for (const parsedNode of parsedNodes) {
                        this.repository.saveNode(parsedNode);
                    }
                    const pruned = this.pruneStaleCommunityRows(packageName, staleRows, nodeTypes);
                    this.carryOverPackageDocs(existingRows, nodeTypes);
                    return pruned;
                });
                result.saved++;
                result.nodesSaved += parsedNodes.length;
                result.nodesRemoved += removed;
                if (progressCallback) {
                    progressCallback(`Saving npm packages`, result.saved + result.skipped, npmPackages.length);
                }
            }
            catch (error) {
                result.errors.push(`Error saving ${pkg.package.name}: ${error.message}`);
            }
        }
        logger_1.logger.info(`npm packages: ${result.saved} saved (${result.nodesSaved} node row(s), ` +
            `${result.nodesRemoved} removed), ${result.skipped} skipped`);
        return result;
    }
    strapiNodeToParsedNode(strapiNode) {
        const { attributes } = strapiNode;
        const nodeDesc = attributes.nodeDescription;
        if (!nodeDesc) {
            logger_1.logger.warn(`No nodeDescription for ${attributes.packageName}`);
            return null;
        }
        let nodeType = nodeDesc.name || `${attributes.packageName}.${attributes.name}`;
        if (nodeType.includes('n8n-nodes-preview-')) {
            nodeType = nodeType.replace('n8n-nodes-preview-', 'n8n-nodes-');
        }
        const usableAsTool = nodeDesc.usableAsTool;
        const declaresToolUse = usableAsTool !== undefined && usableAsTool !== null && usableAsTool !== false;
        const hasAICategory = nodeDesc.codex?.categories?.includes('AI') ?? false;
        const isAITool = declaresToolUse || hasAICategory;
        return {
            nodeType,
            packageName: attributes.packageName,
            displayName: nodeDesc.displayName || attributes.displayName,
            description: nodeDesc.description || attributes.description,
            category: nodeDesc.codex?.categories?.[0] || 'Community',
            style: 'declarative',
            properties: nodeDesc.properties || [],
            credentials: nodeDesc.credentials || [],
            operations: this.extractOperations(nodeDesc),
            isAITool,
            isTrigger: nodeDesc.group?.includes('trigger') || false,
            isWebhook: nodeDesc.name?.toLowerCase().includes('webhook') ||
                nodeDesc.group?.includes('webhook') ||
                false,
            isVersioned: (attributes.nodeVersions?.length || 0) > 1,
            version: ((0, typeversion_1.parseTypeVersion)(nodeDesc.version) ?? 1).toString(),
            outputs: nodeDesc.outputs,
            outputNames: nodeDesc.outputNames,
            isCommunity: true,
            isVerified: true,
            authorName: attributes.authorName,
            authorGithubUrl: attributes.authorGithubUrl,
            npmPackageName: attributes.packageName,
            npmVersion: attributes.npmVersion,
            npmDownloads: attributes.numberOfDownloads || 0,
            communityFetchedAt: new Date().toISOString(),
        };
    }
    npmPackageToParsedNodes(pkg, resolved) {
        const { package: pkgInfo, score } = pkg;
        const perNodeSignal = resolved.names.length > 1;
        return resolved.names.map((nodeName) => ({
            nodeType: `${pkgInfo.name}.${nodeName}`,
            packageName: pkgInfo.name,
            displayName: nodeName,
            description: pkgInfo.description || `Community node from ${pkgInfo.name}`,
            category: 'Community',
            style: 'declarative',
            properties: [],
            credentials: [],
            operations: [],
            isAITool: false,
            isTrigger: this.matchesRole(pkgInfo.name, nodeName, 'trigger', perNodeSignal),
            isWebhook: this.matchesRole(pkgInfo.name, nodeName, 'webhook', perNodeSignal),
            isVersioned: false,
            version: '1',
            isCommunity: true,
            isVerified: false,
            authorName: pkgInfo.author?.name || pkgInfo.publisher?.username,
            authorGithubUrl: pkgInfo.links?.repository,
            npmPackageName: pkgInfo.name,
            npmVersion: pkgInfo.version,
            npmDownloads: Math.round(score.detail.popularity * 10000),
            communityFetchedAt: new Date().toISOString(),
        }));
    }
    matchesRole(packageName, nodeName, role, perNodeSignal) {
        if (nodeName.toLowerCase().includes(role)) {
            return true;
        }
        return perNodeSignal ? false : packageName.includes(role);
    }
    extractOperations(nodeDesc) {
        const operations = [];
        if (nodeDesc.properties) {
            for (const prop of nodeDesc.properties) {
                if ((prop.name === 'operation' || prop.name === 'action') && prop.options) {
                    const resource = prop.displayOptions?.show?.resource?.[0];
                    for (const op of prop.options) {
                        operations.push({
                            ...op,
                            ...(resource ? { resource } : {})
                        });
                    }
                }
            }
        }
        return operations;
    }
    rowsOutOfSync(existingRows, nodeTypes, staleRows) {
        const storedTypes = new Set(existingRows.map((row) => row.nodeType));
        return nodeTypes.some((nodeType) => !storedTypes.has(nodeType)) || staleRows.length > 0;
    }
    staleCommunityRows(existingRows, nodeTypes) {
        const keep = new Set(nodeTypes);
        return existingRows.filter((row) => row.isCommunity && !row.isVerified && row.nodeType && !keep.has(row.nodeType));
    }
    pruneStaleCommunityRows(packageName, staleRows, nodeTypes) {
        if (staleRows.length === 0) {
            return 0;
        }
        const removed = this.repository.deleteStaleCommunityNodes(packageName, nodeTypes);
        logger_1.logger.info(`${packageName}: removed ${removed} row(s) the package no longer declares ` +
            `(${staleRows.map((row) => row.nodeType).join(', ')})`);
        return removed;
    }
    carryOverPackageDocs(existingRows, nodeTypes) {
        const readme = existingRows.find((row) => row.npmReadme)?.npmReadme;
        const summary = existingRows.find((row) => row.aiDocumentationSummary)?.aiDocumentationSummary;
        if (!readme && !summary) {
            return;
        }
        const storedByType = new Map(existingRows.map((row) => [row.nodeType, row]));
        for (const nodeType of nodeTypes) {
            const stored = storedByType.get(nodeType);
            if (readme && !stored?.npmReadme) {
                this.repository.updateNodeReadme(nodeType, readme);
            }
            if (summary && !stored?.aiDocumentationSummary) {
                this.repository.updateNodeAISummary(nodeType, summary);
            }
        }
    }
    async resolveNpmNodeNames(packageName, version) {
        let packageJson = null;
        try {
            packageJson = await this.fetcher.fetchPackageJson(packageName, version, NPM_MANIFEST_FETCH);
        }
        catch (error) {
            logger_1.logger.warn(`Could not fetch package.json for ${packageName}: ${error.message}`);
        }
        const fallback = this.extractNodeNameFromPackage(packageName);
        if (!packageJson) {
            logger_1.logger.warn(`Could not read package.json for ${packageName}, falling back to the package-name heuristic: "${fallback}"`);
            return { names: [fallback], source: 'unavailable' };
        }
        const entries = Array.isArray(packageJson?.n8n?.nodes) ? packageJson.n8n.nodes : [];
        const nodeNames = new Set();
        for (const entry of entries) {
            const nodeName = typeof entry === 'string' ? extractNodeNameFromEntryPath(entry) : undefined;
            if (nodeName) {
                nodeNames.add(nodeName);
            }
        }
        if (nodeNames.size > 0) {
            const names = [...nodeNames];
            if (names.length > MAX_NODES_PER_PACKAGE) {
                logger_1.logger.warn(`${packageName} declares ${names.length} nodes, storing the first ${MAX_NODES_PER_PACKAGE}`);
                names.length = MAX_NODES_PER_PACKAGE;
            }
            return { names, source: 'manifest' };
        }
        logger_1.logger.warn(`No usable n8n.nodes entry for ${packageName}, falling back to the package-name heuristic: "${fallback}"`);
        return { names: [fallback], source: 'fallback' };
    }
    extractNodeNameFromPackage(packageName) {
        let name = packageName.replace(/^@[^/]+\//, '');
        name = name.replace(/^n8n-nodes-/, '');
        return name.replace(/-/g, '').toLowerCase();
    }
    getCommunityStats() {
        return this.repository.getCommunityStats();
    }
    deleteCommunityNodes() {
        return this.repository.deleteCommunityNodes();
    }
}
exports.CommunityNodeService = CommunityNodeService;
//# sourceMappingURL=community-node-service.js.map