"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeVersionService = void 0;
const node_parser_1 = require("../parsers/node-parser");
class NodeVersionService {
    constructor(nodeRepository, breakingChangeDetector) {
        this.nodeRepository = nodeRepository;
        this.breakingChangeDetector = breakingChangeDetector;
        this.versionCache = new Map();
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
    }
    getAvailableVersions(nodeType) {
        const cached = this.getCachedVersions(nodeType);
        if (cached)
            return cached;
        const versions = this.nodeRepository.getNodeVersions(nodeType);
        this.cacheVersions(nodeType, versions);
        return versions;
    }
    getLatestVersion(nodeType) {
        const versions = this.getAvailableVersions(nodeType);
        if (versions.length === 0) {
            const node = this.nodeRepository.getNode(nodeType);
            return node?.version || null;
        }
        const maxVersion = versions.find(v => v.isCurrentMax);
        if (maxVersion)
            return maxVersion.version;
        const sorted = versions.sort((a, b) => this.compareVersions(b.version, a.version));
        return sorted[0]?.version || null;
    }
    compareVersions(currentVersion, latestVersion) {
        const parts1 = currentVersion.split('.').map(Number);
        const parts2 = latestVersion.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 < p2)
                return -1;
            if (p1 > p2)
                return 1;
        }
        return 0;
    }
    analyzeVersion(nodeType, currentVersion) {
        const latestVersion = this.getLatestVersion(nodeType);
        if (!latestVersion) {
            return {
                nodeType,
                currentVersion,
                latestVersion: currentVersion,
                isOutdated: false,
                versionGap: 0,
                hasBreakingChanges: false,
                recommendUpgrade: false,
                confidence: 'HIGH',
                reason: 'No version information available. Using current version.'
            };
        }
        const comparison = this.compareVersions(currentVersion, latestVersion);
        const isOutdated = comparison < 0;
        if (!isOutdated) {
            return {
                nodeType,
                currentVersion,
                latestVersion,
                isOutdated: false,
                versionGap: 0,
                hasBreakingChanges: false,
                recommendUpgrade: false,
                confidence: 'HIGH',
                reason: 'Node is already at the latest version.'
            };
        }
        const versionGap = this.calculateVersionGap(currentVersion, latestVersion);
        const hasBreakingChanges = this.breakingChangeDetector.hasBreakingChanges(nodeType, currentVersion, latestVersion);
        let recommendUpgrade = true;
        let confidence = 'HIGH';
        let reason = `Version ${latestVersion} available. `;
        if (hasBreakingChanges) {
            confidence = 'MEDIUM';
            reason += 'Contains breaking changes. Review before upgrading.';
        }
        else {
            reason += 'Safe to upgrade (no breaking changes detected).';
        }
        if (versionGap > 2) {
            confidence = 'LOW';
            reason += ` Version gap is large (${versionGap} versions). Consider incremental upgrade.`;
        }
        return {
            nodeType,
            currentVersion,
            latestVersion,
            isOutdated,
            versionGap,
            hasBreakingChanges,
            recommendUpgrade,
            confidence,
            reason
        };
    }
    calculateVersionGap(fromVersion, toVersion) {
        const from = fromVersion.split('.').map(Number);
        const to = toVersion.split('.').map(Number);
        let gap = 0;
        for (let i = 0; i < Math.max(from.length, to.length); i++) {
            const f = from[i] || 0;
            const t = to[i] || 0;
            gap += Math.abs(t - f);
        }
        return gap;
    }
    async suggestUpgradePath(nodeType, currentVersion) {
        const latestVersion = this.getLatestVersion(nodeType);
        if (!latestVersion)
            return null;
        const comparison = this.compareVersions(currentVersion, latestVersion);
        if (comparison >= 0)
            return null;
        const allVersions = this.getAvailableVersions(nodeType);
        const intermediateVersions = allVersions
            .filter(v => this.compareVersions(v.version, currentVersion) > 0 &&
            this.compareVersions(v.version, latestVersion) < 0)
            .map(v => v.version)
            .sort((a, b) => this.compareVersions(a, b));
        const analysis = await this.breakingChangeDetector.analyzeVersionUpgrade(nodeType, currentVersion, latestVersion);
        const versionGap = this.calculateVersionGap(currentVersion, latestVersion);
        const direct = versionGap <= 1 || !analysis.hasBreakingChanges;
        const steps = [];
        if (direct || intermediateVersions.length === 0) {
            steps.push({
                fromVersion: currentVersion,
                toVersion: latestVersion,
                breakingChanges: analysis.changes.filter(c => c.isBreaking).length,
                migrationHints: analysis.recommendations
            });
        }
        else {
            let stepFrom = currentVersion;
            for (const intermediateVersion of intermediateVersions) {
                const stepAnalysis = await this.breakingChangeDetector.analyzeVersionUpgrade(nodeType, stepFrom, intermediateVersion);
                steps.push({
                    fromVersion: stepFrom,
                    toVersion: intermediateVersion,
                    breakingChanges: stepAnalysis.changes.filter(c => c.isBreaking).length,
                    migrationHints: stepAnalysis.recommendations
                });
                stepFrom = intermediateVersion;
            }
            const finalStepAnalysis = await this.breakingChangeDetector.analyzeVersionUpgrade(nodeType, stepFrom, latestVersion);
            steps.push({
                fromVersion: stepFrom,
                toVersion: latestVersion,
                breakingChanges: finalStepAnalysis.changes.filter(c => c.isBreaking).length,
                migrationHints: finalStepAnalysis.recommendations
            });
        }
        const totalBreakingChanges = steps.reduce((sum, step) => sum + step.breakingChanges, 0);
        let estimatedEffort = 'LOW';
        if (totalBreakingChanges > 5 || steps.length > 3) {
            estimatedEffort = 'HIGH';
        }
        else if (totalBreakingChanges > 2 || steps.length > 1) {
            estimatedEffort = 'MEDIUM';
        }
        return {
            nodeType,
            fromVersion: currentVersion,
            toVersion: latestVersion,
            direct,
            intermediateVersions,
            totalBreakingChanges,
            autoMigratableChanges: analysis.autoMigratableCount,
            manualRequiredChanges: analysis.manualRequiredCount,
            estimatedEffort,
            steps
        };
    }
    versionExists(nodeType, version) {
        const wanted = (0, node_parser_1.normalizeNodeVersion)(version);
        return this.getAvailableVersions(nodeType).some(v => (0, node_parser_1.normalizeNodeVersion)(v.version) === wanted);
    }
    getVersionMetadata(nodeType, version) {
        const versionData = this.nodeRepository.getNodeVersion(nodeType, version);
        return versionData;
    }
    clearCache(nodeType) {
        if (nodeType) {
            this.versionCache.delete(nodeType);
            this.cacheTimestamps.delete(nodeType);
        }
        else {
            this.versionCache.clear();
            this.cacheTimestamps.clear();
        }
    }
    getCachedVersions(nodeType) {
        const cached = this.versionCache.get(nodeType);
        const timestamp = this.cacheTimestamps.get(nodeType);
        if (cached && timestamp) {
            const age = Date.now() - timestamp;
            if (age < this.cacheTTL) {
                return cached;
            }
        }
        return null;
    }
    cacheVersions(nodeType, versions) {
        this.versionCache.set(nodeType, versions);
        this.cacheTimestamps.set(nodeType, Date.now());
    }
}
exports.NodeVersionService = NodeVersionService;
//# sourceMappingURL=node-version-service.js.map