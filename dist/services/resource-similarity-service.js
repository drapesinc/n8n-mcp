"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceSimilarityService = void 0;
const logger_1 = require("../utils/logger");
class ResourceSimilarityService {
    constructor(repository) {
        this.resourceCache = new Map();
        this.suggestionCache = new Map();
        this.repository = repository;
        this.commonPatterns = this.initializeCommonPatterns();
    }
    cleanupExpiredEntries() {
        const now = Date.now();
        for (const [key, value] of this.resourceCache.entries()) {
            if (now - value.timestamp >= ResourceSimilarityService.CACHE_DURATION_MS) {
                this.resourceCache.delete(key);
            }
        }
        if (this.suggestionCache.size > 100) {
            const entries = Array.from(this.suggestionCache.entries());
            this.suggestionCache.clear();
            entries.slice(-50).forEach(([key, value]) => {
                this.suggestionCache.set(key, value);
            });
        }
    }
    static setBounded(cache, key, value, maxEntries) {
        if (key.length > ResourceSimilarityService.MAX_CACHE_KEY_LENGTH)
            return;
        cache.delete(key);
        while (cache.size >= maxEntries) {
            const oldest = cache.keys().next().value;
            if (oldest === undefined)
                break;
            cache.delete(oldest);
        }
        cache.set(key, value);
    }
    initializeCommonPatterns() {
        const patterns = new Map();
        patterns.set('googleDrive', [
            { pattern: 'files', suggestion: 'file', confidence: 0.95, reason: 'Use singular "file" not plural' },
            { pattern: 'folders', suggestion: 'folder', confidence: 0.95, reason: 'Use singular "folder" not plural' },
            { pattern: 'permissions', suggestion: 'permission', confidence: 0.9, reason: 'Use singular form' },
            { pattern: 'fileAndFolder', suggestion: 'fileFolder', confidence: 0.9, reason: 'Use "fileFolder" for combined operations' },
            { pattern: 'driveFiles', suggestion: 'file', confidence: 0.8, reason: 'Use "file" for file operations' },
            { pattern: 'sharedDrives', suggestion: 'drive', confidence: 0.85, reason: 'Use "drive" for shared drive operations' },
        ]);
        patterns.set('slack', [
            { pattern: 'messages', suggestion: 'message', confidence: 0.95, reason: 'Use singular "message" not plural' },
            { pattern: 'channels', suggestion: 'channel', confidence: 0.95, reason: 'Use singular "channel" not plural' },
            { pattern: 'users', suggestion: 'user', confidence: 0.95, reason: 'Use singular "user" not plural' },
            { pattern: 'msg', suggestion: 'message', confidence: 0.85, reason: 'Use full "message" not abbreviation' },
            { pattern: 'dm', suggestion: 'message', confidence: 0.7, reason: 'Use "message" for direct messages' },
            { pattern: 'conversation', suggestion: 'channel', confidence: 0.7, reason: 'Use "channel" for conversations' },
        ]);
        patterns.set('database', [
            { pattern: 'tables', suggestion: 'table', confidence: 0.95, reason: 'Use singular "table" not plural' },
            { pattern: 'queries', suggestion: 'query', confidence: 0.95, reason: 'Use singular "query" not plural' },
            { pattern: 'collections', suggestion: 'collection', confidence: 0.95, reason: 'Use singular "collection" not plural' },
            { pattern: 'documents', suggestion: 'document', confidence: 0.95, reason: 'Use singular "document" not plural' },
            { pattern: 'records', suggestion: 'record', confidence: 0.85, reason: 'Use "record" or "document"' },
            { pattern: 'rows', suggestion: 'row', confidence: 0.9, reason: 'Use singular "row"' },
        ]);
        patterns.set('googleSheets', [
            { pattern: 'sheets', suggestion: 'sheet', confidence: 0.95, reason: 'Use singular "sheet" not plural' },
            { pattern: 'spreadsheets', suggestion: 'spreadsheet', confidence: 0.95, reason: 'Use singular "spreadsheet"' },
            { pattern: 'cells', suggestion: 'cell', confidence: 0.9, reason: 'Use singular "cell"' },
            { pattern: 'ranges', suggestion: 'range', confidence: 0.9, reason: 'Use singular "range"' },
            { pattern: 'worksheets', suggestion: 'sheet', confidence: 0.8, reason: 'Use "sheet" for worksheet operations' },
        ]);
        patterns.set('email', [
            { pattern: 'emails', suggestion: 'email', confidence: 0.95, reason: 'Use singular "email" not plural' },
            { pattern: 'messages', suggestion: 'message', confidence: 0.9, reason: 'Use "message" for email operations' },
            { pattern: 'mails', suggestion: 'email', confidence: 0.9, reason: 'Use "email" not "mail"' },
            { pattern: 'attachments', suggestion: 'attachment', confidence: 0.95, reason: 'Use singular "attachment"' },
        ]);
        patterns.set('generic', [
            { pattern: 'items', suggestion: 'item', confidence: 0.9, reason: 'Use singular form' },
            { pattern: 'objects', suggestion: 'object', confidence: 0.9, reason: 'Use singular form' },
            { pattern: 'entities', suggestion: 'entity', confidence: 0.9, reason: 'Use singular form' },
            { pattern: 'resources', suggestion: 'resource', confidence: 0.9, reason: 'Use singular form' },
            { pattern: 'elements', suggestion: 'element', confidence: 0.9, reason: 'Use singular form' },
        ]);
        return patterns;
    }
    findSimilarResources(nodeType, invalidResource, maxSuggestions = ResourceSimilarityService.MAX_SUGGESTIONS) {
        if (typeof invalidResource === 'string' && invalidResource.length > ResourceSimilarityService.MAX_NAME_LENGTH) {
            return [];
        }
        if (Math.random() < 0.1) {
            this.cleanupExpiredEntries();
        }
        const cacheKey = `${nodeType}:${invalidResource}`;
        if (this.suggestionCache.has(cacheKey)) {
            return this.suggestionCache.get(cacheKey);
        }
        const suggestions = [];
        const validResources = this.getNodeResources(nodeType);
        for (const resource of validResources) {
            const resourceValue = this.getResourceValue(resource);
            if (resourceValue.toLowerCase() === invalidResource.toLowerCase()) {
                return [];
            }
        }
        const nodePatterns = this.getNodePatterns(nodeType);
        for (const pattern of nodePatterns) {
            if (pattern.pattern.toLowerCase() === invalidResource.toLowerCase()) {
                const exists = validResources.some(r => {
                    const resourceValue = this.getResourceValue(r);
                    return resourceValue === pattern.suggestion;
                });
                if (exists) {
                    suggestions.push({
                        value: pattern.suggestion,
                        confidence: pattern.confidence,
                        reason: pattern.reason
                    });
                }
            }
        }
        const singularForm = this.toSingular(invalidResource);
        const pluralForm = this.toPlural(invalidResource);
        for (const resource of validResources) {
            const resourceValue = this.getResourceValue(resource);
            if (resourceValue === singularForm || resourceValue === pluralForm) {
                if (!suggestions.some(s => s.value === resourceValue)) {
                    suggestions.push({
                        value: resourceValue,
                        confidence: 0.9,
                        reason: invalidResource.endsWith('s') ?
                            'Use singular form for resources' :
                            'Incorrect plural/singular form',
                        availableOperations: typeof resource === 'object' ? resource.operations : undefined
                    });
                }
            }
            const similarity = this.calculateSimilarity(invalidResource, resourceValue);
            if (similarity >= ResourceSimilarityService.MIN_CONFIDENCE) {
                if (!suggestions.some(s => s.value === resourceValue)) {
                    suggestions.push({
                        value: resourceValue,
                        confidence: similarity,
                        reason: this.getSimilarityReason(similarity, invalidResource, resourceValue),
                        availableOperations: typeof resource === 'object' ? resource.operations : undefined
                    });
                }
            }
        }
        suggestions.sort((a, b) => b.confidence - a.confidence);
        const topSuggestions = suggestions.slice(0, maxSuggestions);
        ResourceSimilarityService.setBounded(this.suggestionCache, cacheKey, topSuggestions, ResourceSimilarityService.MAX_SUGGESTION_CACHE_ENTRIES);
        return topSuggestions;
    }
    getResourceValue(resource) {
        if (typeof resource === 'string') {
            return resource;
        }
        if (typeof resource === 'object' && resource !== null) {
            return resource.value || '';
        }
        return '';
    }
    getNodeResources(nodeType) {
        if (Math.random() < 0.05) {
            this.cleanupExpiredEntries();
        }
        const cacheKey = nodeType;
        const cached = this.resourceCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < ResourceSimilarityService.CACHE_DURATION_MS) {
            return cached.resources;
        }
        const nodeInfo = this.repository.getNode(nodeType);
        if (!nodeInfo)
            return [];
        const resources = [];
        const resourceMap = new Map();
        try {
            const properties = nodeInfo.properties || [];
            for (const prop of properties) {
                if (prop.name === 'resource' && prop.options) {
                    for (const option of prop.options) {
                        resources.push({
                            value: option.value,
                            name: option.name,
                            operations: []
                        });
                        resourceMap.set(option.value, []);
                    }
                }
                if (prop.name === 'operation' && prop.displayOptions?.show?.resource) {
                    const resourceValues = Array.isArray(prop.displayOptions.show.resource)
                        ? prop.displayOptions.show.resource
                        : [prop.displayOptions.show.resource];
                    for (const resourceValue of resourceValues) {
                        if (resourceMap.has(resourceValue) && prop.options) {
                            const ops = prop.options.map((op) => op.value);
                            resourceMap.get(resourceValue).push(...ops);
                        }
                    }
                }
            }
            for (const resource of resources) {
                if (resourceMap.has(resource.value)) {
                    resource.operations = resourceMap.get(resource.value);
                }
            }
            if (resources.length === 0) {
                const implicitResources = this.extractImplicitResources(properties);
                resources.push(...implicitResources);
            }
        }
        catch (error) {
            logger_1.logger.warn(`Failed to extract resources for ${nodeType}:`, error);
        }
        ResourceSimilarityService.setBounded(this.resourceCache, cacheKey, { resources, timestamp: Date.now() }, ResourceSimilarityService.MAX_RESOURCE_CACHE_ENTRIES);
        return resources;
    }
    extractImplicitResources(properties) {
        const resources = [];
        for (const prop of properties) {
            if (prop.name === 'operation' && prop.options) {
                const resourceFromOps = this.inferResourceFromOperations(prop.options);
                if (resourceFromOps) {
                    resources.push({
                        value: resourceFromOps,
                        name: resourceFromOps.charAt(0).toUpperCase() + resourceFromOps.slice(1),
                        operations: prop.options.map((op) => op.value)
                    });
                }
            }
        }
        return resources;
    }
    inferResourceFromOperations(operations) {
        const patterns = [
            { keywords: ['file', 'upload', 'download'], resource: 'file' },
            { keywords: ['folder', 'directory'], resource: 'folder' },
            { keywords: ['message', 'send', 'reply'], resource: 'message' },
            { keywords: ['channel', 'broadcast'], resource: 'channel' },
            { keywords: ['user', 'member'], resource: 'user' },
            { keywords: ['table', 'row', 'column'], resource: 'table' },
            { keywords: ['document', 'doc'], resource: 'document' },
        ];
        for (const pattern of patterns) {
            for (const op of operations) {
                const opName = (op.value || op).toLowerCase();
                if (pattern.keywords.some(keyword => opName.includes(keyword))) {
                    return pattern.resource;
                }
            }
        }
        return null;
    }
    getNodePatterns(nodeType) {
        const patterns = [];
        if (nodeType.includes('googleDrive')) {
            patterns.push(...(this.commonPatterns.get('googleDrive') || []));
        }
        else if (nodeType.includes('slack')) {
            patterns.push(...(this.commonPatterns.get('slack') || []));
        }
        else if (nodeType.includes('postgres') || nodeType.includes('mysql') || nodeType.includes('mongodb')) {
            patterns.push(...(this.commonPatterns.get('database') || []));
        }
        else if (nodeType.includes('googleSheets')) {
            patterns.push(...(this.commonPatterns.get('googleSheets') || []));
        }
        else if (nodeType.includes('gmail') || nodeType.includes('email')) {
            patterns.push(...(this.commonPatterns.get('email') || []));
        }
        patterns.push(...(this.commonPatterns.get('generic') || []));
        return patterns;
    }
    toSingular(word) {
        if (word.endsWith('ies')) {
            return word.slice(0, -3) + 'y';
        }
        else if (word.endsWith('es')) {
            return word.slice(0, -2);
        }
        else if (word.endsWith('s') && !word.endsWith('ss')) {
            return word.slice(0, -1);
        }
        return word;
    }
    toPlural(word) {
        if (word.endsWith('y') && !['ay', 'ey', 'iy', 'oy', 'uy'].includes(word.slice(-2))) {
            return word.slice(0, -1) + 'ies';
        }
        else if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z') ||
            word.endsWith('ch') || word.endsWith('sh')) {
            return word + 'es';
        }
        else {
            return word + 's';
        }
    }
    calculateSimilarity(str1, str2) {
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        if (s1 === s2)
            return 1.0;
        if (s1.includes(s2) || s2.includes(s1)) {
            const ratio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
            return Math.max(ResourceSimilarityService.CONFIDENCE_THRESHOLDS.MIN_SUBSTRING, ratio);
        }
        const distance = this.levenshteinDistance(s1, s2);
        const maxLength = Math.max(s1.length, s2.length);
        let similarity = 1 - (distance / maxLength);
        if (distance === 1 && maxLength <= 5) {
            similarity = Math.max(similarity, 0.75);
        }
        else if (distance === 2 && maxLength <= 5) {
            similarity = Math.max(similarity, 0.72);
        }
        return similarity;
    }
    levenshteinDistance(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        if (m === 0)
            return n;
        if (n === 0)
            return m;
        let prev = new Array(n + 1);
        let curr = new Array(n + 1);
        for (let j = 0; j <= n; j++)
            prev[j] = j;
        for (let i = 1; i <= m; i++) {
            curr[0] = i;
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    curr[j] = prev[j - 1];
                }
                else {
                    curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + 1);
                }
            }
            [prev, curr] = [curr, prev];
        }
        return prev[n];
    }
    getSimilarityReason(confidence, invalid, valid) {
        const { VERY_HIGH, HIGH, MEDIUM } = ResourceSimilarityService.CONFIDENCE_THRESHOLDS;
        if (confidence >= VERY_HIGH) {
            return 'Almost exact match - likely a typo';
        }
        else if (confidence >= HIGH) {
            return 'Very similar - common variation';
        }
        else if (confidence >= MEDIUM) {
            return 'Similar resource name';
        }
        else if (invalid.includes(valid) || valid.includes(invalid)) {
            return 'Partial match';
        }
        else {
            return 'Possibly related resource';
        }
    }
    clearCache() {
        this.resourceCache.clear();
        this.suggestionCache.clear();
    }
}
exports.ResourceSimilarityService = ResourceSimilarityService;
ResourceSimilarityService.CACHE_DURATION_MS = 5 * 60 * 1000;
ResourceSimilarityService.MIN_CONFIDENCE = 0.3;
ResourceSimilarityService.MAX_SUGGESTIONS = 5;
ResourceSimilarityService.MAX_NAME_LENGTH = 128;
ResourceSimilarityService.MAX_CACHE_KEY_LENGTH = 512;
ResourceSimilarityService.MAX_RESOURCE_CACHE_ENTRIES = 500;
ResourceSimilarityService.MAX_SUGGESTION_CACHE_ENTRIES = 100;
ResourceSimilarityService.CONFIDENCE_THRESHOLDS = {
    EXACT: 1.0,
    VERY_HIGH: 0.95,
    HIGH: 0.8,
    MEDIUM: 0.6,
    MIN_SUBSTRING: 0.7
};
//# sourceMappingURL=resource-similarity-service.js.map