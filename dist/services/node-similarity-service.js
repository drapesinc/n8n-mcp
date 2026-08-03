"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeSimilarityService = void 0;
const logger_1 = require("../utils/logger");
const tool_variant_generator_1 = require("./tool-variant-generator");
class NodeSimilarityService {
    constructor(repository) {
        this.nodeCache = null;
        this.cacheExpiry = 0;
        this.cacheVersion = 0;
        this.repository = repository;
        this.commonMistakes = this.initializeCommonMistakes();
    }
    initializeCommonMistakes() {
        const patterns = new Map();
        patterns.set('case_variations', [
            { pattern: 'httprequest', suggestion: 'nodes-base.httpRequest', confidence: 0.95, reason: 'Incorrect capitalization' },
            { pattern: 'webhook', suggestion: 'nodes-base.webhook', confidence: 0.95, reason: 'Incorrect capitalization' },
            { pattern: 'slack', suggestion: 'nodes-base.slack', confidence: 0.9, reason: 'Missing package prefix' },
            { pattern: 'gmail', suggestion: 'nodes-base.gmail', confidence: 0.9, reason: 'Missing package prefix' },
            { pattern: 'googlesheets', suggestion: 'nodes-base.googleSheets', confidence: 0.9, reason: 'Missing package prefix' },
            { pattern: 'telegram', suggestion: 'nodes-base.telegram', confidence: 0.9, reason: 'Missing package prefix' },
        ]);
        patterns.set('specific_variations', [
            { pattern: 'HttpRequest', suggestion: 'nodes-base.httpRequest', confidence: 0.95, reason: 'Incorrect capitalization' },
            { pattern: 'HTTPRequest', suggestion: 'nodes-base.httpRequest', confidence: 0.95, reason: 'Common capitalization mistake' },
            { pattern: 'Webhook', suggestion: 'nodes-base.webhook', confidence: 0.95, reason: 'Incorrect capitalization' },
            { pattern: 'WebHook', suggestion: 'nodes-base.webhook', confidence: 0.95, reason: 'Common capitalization mistake' },
        ]);
        patterns.set('deprecated_prefixes', [
            { pattern: 'n8n-nodes-base.', suggestion: 'nodes-base.', confidence: 0.95, reason: 'Full package name used instead of short form' },
            { pattern: '@n8n/n8n-nodes-langchain.', suggestion: 'nodes-langchain.', confidence: 0.95, reason: 'Full package name used instead of short form' },
        ]);
        patterns.set('typos', [
            { pattern: 'htprequest', suggestion: 'nodes-base.httpRequest', confidence: 0.8, reason: 'Likely typo' },
            { pattern: 'httpreqest', suggestion: 'nodes-base.httpRequest', confidence: 0.8, reason: 'Likely typo' },
            { pattern: 'webook', suggestion: 'nodes-base.webhook', confidence: 0.8, reason: 'Likely typo' },
            { pattern: 'slak', suggestion: 'nodes-base.slack', confidence: 0.8, reason: 'Likely typo' },
            { pattern: 'googlesheets', suggestion: 'nodes-base.googleSheets', confidence: 0.8, reason: 'Likely typo' },
        ]);
        patterns.set('ai_nodes', [
            { pattern: 'openai', suggestion: 'nodes-langchain.openAi', confidence: 0.85, reason: 'AI node - incorrect package' },
            { pattern: 'nodes-base.openai', suggestion: 'nodes-langchain.openAi', confidence: 0.9, reason: 'Wrong package - OpenAI is in LangChain package' },
            { pattern: 'chatopenai', suggestion: 'nodes-langchain.lmChatOpenAi', confidence: 0.85, reason: 'LangChain node naming convention' },
            { pattern: 'vectorstore', suggestion: 'nodes-langchain.vectorStoreInMemory', confidence: 0.7, reason: 'Generic vector store reference' },
        ]);
        return patterns;
    }
    isCommonNodeWithoutPrefix(type) {
        const commonNodes = {
            'httprequest': 'nodes-base.httpRequest',
            'webhook': 'nodes-base.webhook',
            'slack': 'nodes-base.slack',
            'gmail': 'nodes-base.gmail',
            'googlesheets': 'nodes-base.googleSheets',
            'telegram': 'nodes-base.telegram',
            'discord': 'nodes-base.discord',
            'notion': 'nodes-base.notion',
            'airtable': 'nodes-base.airtable',
            'postgres': 'nodes-base.postgres',
            'mysql': 'nodes-base.mySql',
            'mongodb': 'nodes-base.mongoDb',
        };
        const normalized = type.toLowerCase();
        return commonNodes[normalized] || null;
    }
    async findSimilarNodes(invalidType, limit = 5) {
        if (!invalidType || invalidType.trim() === '') {
            return [];
        }
        if (tool_variant_generator_1.ToolVariantGenerator.isToolVariantNodeType(invalidType)) {
            const baseNodeType = tool_variant_generator_1.ToolVariantGenerator.getBaseNodeType(invalidType);
            if (baseNodeType) {
                const baseNode = this.repository.getNode(baseNodeType);
                if (baseNode) {
                    return [{
                            nodeType: invalidType,
                            displayName: `${baseNode.displayName} Tool`,
                            confidence: 0.98,
                            reason: `Dynamic AI Tool variant of ${baseNode.displayName}`,
                            category: baseNode.category,
                            description: 'Runtime-generated Tool variant for AI Agent integration'
                        }];
                }
            }
        }
        const suggestions = [];
        const mistakeSuggestion = this.checkCommonMistakes(invalidType);
        if (mistakeSuggestion) {
            suggestions.push(mistakeSuggestion);
        }
        const allNodes = await this.getCachedNodes();
        const scores = allNodes.map(node => ({
            node,
            score: this.calculateSimilarityScore(invalidType, node)
        }));
        scores.sort((a, b) => b.score.totalScore - a.score.totalScore);
        for (const { node, score } of scores) {
            if (suggestions.some(s => s.nodeType === node.nodeType)) {
                continue;
            }
            if (score.totalScore >= NodeSimilarityService.SCORING_THRESHOLD) {
                suggestions.push(this.createSuggestion(node, score));
            }
            if (suggestions.length >= limit) {
                break;
            }
        }
        return suggestions;
    }
    checkCommonMistakes(invalidType) {
        const cleanType = invalidType.trim();
        const lowerType = cleanType.toLowerCase();
        const commonNodeSuggestion = this.isCommonNodeWithoutPrefix(cleanType);
        if (commonNodeSuggestion) {
            const node = this.repository.getNode(commonNodeSuggestion);
            if (node) {
                return {
                    nodeType: commonNodeSuggestion,
                    displayName: node.displayName,
                    confidence: 0.9,
                    reason: 'Missing package prefix',
                    category: node.category,
                    description: node.description
                };
            }
        }
        for (const [category, patterns] of this.commonMistakes) {
            if (category === 'deprecated_prefixes') {
                for (const pattern of patterns) {
                    if (cleanType.startsWith(pattern.pattern)) {
                        const actualSuggestion = cleanType.replace(pattern.pattern, pattern.suggestion);
                        const node = this.repository.getNode(actualSuggestion);
                        if (node) {
                            return {
                                nodeType: actualSuggestion,
                                displayName: node.displayName,
                                confidence: pattern.confidence,
                                reason: pattern.reason,
                                category: node.category,
                                description: node.description
                            };
                        }
                    }
                }
            }
        }
        for (const [category, patterns] of this.commonMistakes) {
            if (category === 'deprecated_prefixes')
                continue;
            for (const pattern of patterns) {
                const match = category === 'specific_variations'
                    ? cleanType === pattern.pattern
                    : lowerType === pattern.pattern.toLowerCase();
                if (match && pattern.suggestion) {
                    const node = this.repository.getNode(pattern.suggestion);
                    if (node) {
                        return {
                            nodeType: pattern.suggestion,
                            displayName: node.displayName,
                            confidence: pattern.confidence,
                            reason: pattern.reason,
                            category: node.category,
                            description: node.description
                        };
                    }
                }
            }
        }
        return null;
    }
    calculateSimilarityScore(invalidType, node) {
        const cleanInvalid = this.normalizeNodeType(invalidType);
        const cleanValid = this.normalizeNodeType(node.nodeType);
        const displayNameClean = this.normalizeNodeType(node.displayName);
        const isShortSearch = invalidType.length <= NodeSimilarityService.SHORT_SEARCH_LENGTH;
        let nameSimilarity = Math.max(this.getStringSimilarity(cleanInvalid, cleanValid), this.getStringSimilarity(cleanInvalid, displayNameClean)) * 40;
        if (isShortSearch && (cleanValid.includes(cleanInvalid) || displayNameClean.includes(cleanInvalid))) {
            nameSimilarity = Math.max(nameSimilarity, 10);
        }
        let categoryMatch = 0;
        if (node.category) {
            const categoryClean = this.normalizeNodeType(node.category);
            if (categoryClean.length >= NodeSimilarityService.MIN_CATEGORY_MATCH_LENGTH) {
                const invalidTokens = invalidType.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
                if (invalidTokens.includes(categoryClean)) {
                    categoryMatch = 20;
                }
            }
        }
        let packageMatch = 0;
        const invalidParts = cleanInvalid.split(/[.-]/);
        const validParts = cleanValid.split(/[.-]/);
        if (invalidParts[0] === validParts[0]) {
            packageMatch = 15;
        }
        let patternMatch = 0;
        if (cleanValid.includes(cleanInvalid) || displayNameClean.includes(cleanInvalid)) {
            patternMatch = isShortSearch ? 45 : 25;
        }
        else if (this.getEditDistance(cleanInvalid, cleanValid) <= NodeSimilarityService.TYPO_EDIT_DISTANCE) {
            patternMatch = 20;
        }
        else if (this.getEditDistance(cleanInvalid, displayNameClean) <= NodeSimilarityService.TYPO_EDIT_DISTANCE) {
            patternMatch = 18;
        }
        if (isShortSearch && (cleanValid.startsWith(cleanInvalid) || displayNameClean.startsWith(cleanInvalid))) {
            patternMatch = Math.max(patternMatch, 40);
        }
        const totalScore = nameSimilarity + categoryMatch + packageMatch + patternMatch;
        return {
            nameSimilarity,
            categoryMatch,
            packageMatch,
            patternMatch,
            totalScore
        };
    }
    createSuggestion(node, score) {
        let reason = 'Similar node';
        if (score.patternMatch >= 20) {
            reason = 'Name similarity';
        }
        else if (score.categoryMatch >= 15) {
            reason = 'Same category';
        }
        else if (score.packageMatch >= 10) {
            reason = 'Same package';
        }
        const confidence = Math.min(score.totalScore / 100, 1);
        return {
            nodeType: node.nodeType,
            displayName: node.displayName,
            confidence,
            reason,
            category: node.category,
            description: node.description
        };
    }
    normalizeNodeType(type) {
        return type
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .trim();
    }
    getStringSimilarity(s1, s2, maxDistance = 5) {
        if (s1 === s2)
            return 1;
        if (!s1 || !s2)
            return 0;
        const distance = this.getEditDistance(s1, s2, maxDistance);
        if (distance > maxDistance)
            return 0;
        const maxLen = Math.max(s1.length, s2.length);
        return 1 - (distance / maxLen);
    }
    getEditDistance(s1, s2, maxDistance = 5) {
        if (s1 === s2)
            return 0;
        const m = s1.length;
        const n = s2.length;
        const lengthDiff = Math.abs(m - n);
        if (lengthDiff > maxDistance)
            return maxDistance + 1;
        if (m === 0)
            return n;
        if (n === 0)
            return m;
        let prev = Array(n + 1).fill(0).map((_, i) => i);
        for (let i = 1; i <= m; i++) {
            const curr = [i];
            let minInRow = i;
            for (let j = 1; j <= n; j++) {
                const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
                const val = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
                curr.push(val);
                minInRow = Math.min(minInRow, val);
            }
            if (minInRow > maxDistance) {
                return maxDistance + 1;
            }
            prev = curr;
        }
        return prev[n];
    }
    async getCachedNodes() {
        const now = Date.now();
        if (!this.nodeCache || now > this.cacheExpiry) {
            try {
                const newNodes = this.repository.getAllNodes();
                if (newNodes && newNodes.length > 0) {
                    this.nodeCache = newNodes;
                    this.cacheExpiry = now + NodeSimilarityService.CACHE_DURATION_MS;
                    this.cacheVersion++;
                    logger_1.logger.debug('Node cache refreshed', {
                        count: newNodes.length,
                        version: this.cacheVersion
                    });
                }
                else if (this.nodeCache) {
                    logger_1.logger.warn('Node fetch returned empty, using stale cache');
                }
            }
            catch (error) {
                logger_1.logger.error('Failed to fetch nodes for similarity service', error);
                if (this.nodeCache) {
                    logger_1.logger.info('Using stale cache due to fetch error');
                    return this.nodeCache;
                }
                return [];
            }
        }
        return this.nodeCache || [];
    }
    invalidateCache() {
        this.nodeCache = null;
        this.cacheExpiry = 0;
        this.cacheVersion++;
        logger_1.logger.debug('Node cache invalidated', { version: this.cacheVersion });
    }
    async refreshCache() {
        this.invalidateCache();
        await this.getCachedNodes();
    }
    formatSuggestionMessage(suggestions, invalidType) {
        if (suggestions.length === 0) {
            return `Unknown node type: "${invalidType}". No similar nodes found.`;
        }
        let message = `Unknown node type: "${invalidType}"\n\nDid you mean one of these?\n`;
        for (const suggestion of suggestions) {
            const confidence = Math.round(suggestion.confidence * 100);
            message += `• ${suggestion.nodeType} (${confidence}% match)`;
            if (suggestion.displayName) {
                message += ` - ${suggestion.displayName}`;
            }
            message += `\n  → ${suggestion.reason}`;
            if (suggestion.confidence >= 0.9) {
                message += ' (can be auto-fixed)';
            }
            message += '\n';
        }
        return message;
    }
    isAutoFixable(suggestion) {
        return suggestion.confidence >= NodeSimilarityService.AUTO_FIX_CONFIDENCE;
    }
    clearCache() {
        this.invalidateCache();
    }
}
exports.NodeSimilarityService = NodeSimilarityService;
NodeSimilarityService.SCORING_THRESHOLD = 50;
NodeSimilarityService.TYPO_EDIT_DISTANCE = 2;
NodeSimilarityService.MIN_CATEGORY_MATCH_LENGTH = 4;
NodeSimilarityService.SHORT_SEARCH_LENGTH = 5;
NodeSimilarityService.CACHE_DURATION_MS = 5 * 60 * 1000;
NodeSimilarityService.AUTO_FIX_CONFIDENCE = 0.9;
//# sourceMappingURL=node-similarity-service.js.map