"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationSimilarityService = void 0;
const logger_1 = require("../utils/logger");
const validation_service_error_1 = require("../errors/validation-service-error");
class OperationSimilarityService {
    constructor(repository) {
        this.operationCache = new Map();
        this.suggestionCache = new Map();
        this.repository = repository;
        this.commonPatterns = this.initializeCommonPatterns();
    }
    cleanupExpiredEntries() {
        const now = Date.now();
        for (const [key, value] of this.operationCache.entries()) {
            if (now - value.timestamp >= OperationSimilarityService.CACHE_DURATION_MS) {
                this.operationCache.delete(key);
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
        if (key.length > OperationSimilarityService.MAX_CACHE_KEY_LENGTH)
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
            { pattern: 'listFiles', suggestion: 'search', confidence: 0.85, reason: 'Use "search" with resource: "fileFolder" to list files' },
            { pattern: 'uploadFile', suggestion: 'upload', confidence: 0.95, reason: 'Use "upload" instead of "uploadFile"' },
            { pattern: 'deleteFile', suggestion: 'deleteFile', confidence: 1.0, reason: 'Exact match' },
            { pattern: 'downloadFile', suggestion: 'download', confidence: 0.95, reason: 'Use "download" instead of "downloadFile"' },
            { pattern: 'getFile', suggestion: 'download', confidence: 0.8, reason: 'Use "download" to retrieve file content' },
            { pattern: 'listFolders', suggestion: 'search', confidence: 0.85, reason: 'Use "search" with resource: "fileFolder"' },
        ]);
        patterns.set('slack', [
            { pattern: 'sendMessage', suggestion: 'send', confidence: 0.95, reason: 'Use "send" instead of "sendMessage"' },
            { pattern: 'getMessage', suggestion: 'get', confidence: 0.9, reason: 'Use "get" to retrieve messages' },
            { pattern: 'postMessage', suggestion: 'send', confidence: 0.9, reason: 'Use "send" to post messages' },
            { pattern: 'deleteMessage', suggestion: 'delete', confidence: 0.95, reason: 'Use "delete" instead of "deleteMessage"' },
            { pattern: 'createChannel', suggestion: 'create', confidence: 0.9, reason: 'Use "create" with resource: "channel"' },
        ]);
        patterns.set('database', [
            { pattern: 'selectData', suggestion: 'select', confidence: 0.95, reason: 'Use "select" instead of "selectData"' },
            { pattern: 'insertData', suggestion: 'insert', confidence: 0.95, reason: 'Use "insert" instead of "insertData"' },
            { pattern: 'updateData', suggestion: 'update', confidence: 0.95, reason: 'Use "update" instead of "updateData"' },
            { pattern: 'deleteData', suggestion: 'delete', confidence: 0.95, reason: 'Use "delete" instead of "deleteData"' },
            { pattern: 'query', suggestion: 'select', confidence: 0.7, reason: 'Use "select" for queries' },
            { pattern: 'fetch', suggestion: 'select', confidence: 0.7, reason: 'Use "select" to fetch data' },
        ]);
        patterns.set('httpRequest', [
            { pattern: 'fetch', suggestion: 'GET', confidence: 0.8, reason: 'Use "GET" method for fetching data' },
            { pattern: 'send', suggestion: 'POST', confidence: 0.7, reason: 'Use "POST" method for sending data' },
            { pattern: 'create', suggestion: 'POST', confidence: 0.8, reason: 'Use "POST" method for creating resources' },
            { pattern: 'update', suggestion: 'PUT', confidence: 0.8, reason: 'Use "PUT" method for updating resources' },
            { pattern: 'delete', suggestion: 'DELETE', confidence: 0.9, reason: 'Use "DELETE" method' },
        ]);
        patterns.set('generic', [
            { pattern: 'list', suggestion: 'get', confidence: 0.6, reason: 'Consider using "get" or "search"' },
            { pattern: 'retrieve', suggestion: 'get', confidence: 0.8, reason: 'Use "get" to retrieve data' },
            { pattern: 'fetch', suggestion: 'get', confidence: 0.8, reason: 'Use "get" to fetch data' },
            { pattern: 'remove', suggestion: 'delete', confidence: 0.85, reason: 'Use "delete" to remove items' },
            { pattern: 'add', suggestion: 'create', confidence: 0.7, reason: 'Use "create" to add new items' },
        ]);
        return patterns;
    }
    findSimilarOperations(nodeType, invalidOperation, resource, maxSuggestions = OperationSimilarityService.MAX_SUGGESTIONS) {
        const maxLength = OperationSimilarityService.MAX_NAME_LENGTH;
        if ((typeof invalidOperation === 'string' && invalidOperation.length > maxLength) ||
            (typeof resource === 'string' && resource.length > maxLength)) {
            return [];
        }
        if (Math.random() < 0.1) {
            this.cleanupExpiredEntries();
        }
        const cacheKey = `${nodeType}:${invalidOperation}:${resource || ''}`;
        if (this.suggestionCache.has(cacheKey)) {
            return this.suggestionCache.get(cacheKey);
        }
        const suggestions = [];
        let nodeInfo;
        try {
            nodeInfo = this.repository.getNode(nodeType);
            if (!nodeInfo) {
                return [];
            }
        }
        catch (error) {
            logger_1.logger.warn(`Error getting node ${nodeType}:`, error);
            return [];
        }
        const validOperations = this.getNodeOperations(nodeType, resource);
        for (const op of validOperations) {
            const opValue = this.getOperationValue(op);
            if (opValue.toLowerCase() === invalidOperation.toLowerCase()) {
                return [];
            }
        }
        const nodePatterns = this.getNodePatterns(nodeType);
        for (const pattern of nodePatterns) {
            if (pattern.pattern.toLowerCase() === invalidOperation.toLowerCase()) {
                const exists = validOperations.some(op => {
                    const opValue = this.getOperationValue(op);
                    return opValue === pattern.suggestion;
                });
                if (exists) {
                    suggestions.push({
                        value: pattern.suggestion,
                        confidence: pattern.confidence,
                        reason: pattern.reason,
                        resource
                    });
                }
            }
        }
        for (const op of validOperations) {
            const opValue = this.getOperationValue(op);
            const similarity = this.calculateSimilarity(invalidOperation, opValue);
            if (similarity >= OperationSimilarityService.MIN_CONFIDENCE) {
                if (!suggestions.some(s => s.value === opValue)) {
                    suggestions.push({
                        value: opValue,
                        confidence: similarity,
                        reason: this.getSimilarityReason(similarity, invalidOperation, opValue),
                        resource: typeof op === 'object' ? op.resource : undefined,
                        description: typeof op === 'object' ? (op.description || op.name) : undefined
                    });
                }
            }
        }
        suggestions.sort((a, b) => b.confidence - a.confidence);
        const topSuggestions = suggestions.slice(0, maxSuggestions);
        OperationSimilarityService.setBounded(this.suggestionCache, cacheKey, topSuggestions, OperationSimilarityService.MAX_SUGGESTION_CACHE_ENTRIES);
        return topSuggestions;
    }
    getOperationValue(op) {
        if (typeof op === 'string') {
            return op;
        }
        if (typeof op === 'object' && op !== null) {
            return op.operation || op.value || '';
        }
        return '';
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
    getNodeOperations(nodeType, resource) {
        if (Math.random() < 0.05) {
            this.cleanupExpiredEntries();
        }
        const cacheKey = `${nodeType}:${resource || 'all'}`;
        const cached = this.operationCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < OperationSimilarityService.CACHE_DURATION_MS) {
            return cached.operations;
        }
        const nodeInfo = this.repository.getNode(nodeType);
        if (!nodeInfo)
            return [];
        let operations = [];
        try {
            const opsData = nodeInfo.operations;
            if (typeof opsData === 'string') {
                try {
                    operations = JSON.parse(opsData);
                }
                catch (parseError) {
                    logger_1.logger.error(`JSON parse error for operations in ${nodeType}:`, parseError);
                    throw validation_service_error_1.ValidationServiceError.jsonParseError(nodeType, parseError);
                }
            }
            else if (Array.isArray(opsData)) {
                operations = opsData;
            }
            else if (opsData && typeof opsData === 'object') {
                operations = Object.values(opsData).flat();
            }
        }
        catch (error) {
            if (error instanceof validation_service_error_1.ValidationServiceError) {
                throw error;
            }
            logger_1.logger.warn(`Failed to process operations for ${nodeType}:`, error);
        }
        try {
            const properties = nodeInfo.properties || [];
            for (const prop of properties) {
                if (prop.name === 'operation' && prop.options) {
                    if (prop.displayOptions?.show?.resource) {
                        const allowedResources = Array.isArray(prop.displayOptions.show.resource)
                            ? prop.displayOptions.show.resource
                            : [prop.displayOptions.show.resource];
                        if (resource && !allowedResources.includes(resource)) {
                            continue;
                        }
                    }
                    operations.push(...prop.options.map((opt) => ({
                        operation: opt.value,
                        name: opt.name,
                        description: opt.description,
                        resource
                    })));
                }
            }
        }
        catch (error) {
            logger_1.logger.warn(`Failed to extract operations from properties for ${nodeType}:`, error);
        }
        OperationSimilarityService.setBounded(this.operationCache, cacheKey, { operations, timestamp: Date.now() }, OperationSimilarityService.MAX_OPERATION_CACHE_ENTRIES);
        return operations;
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
        else if (nodeType.includes('httpRequest')) {
            patterns.push(...(this.commonPatterns.get('httpRequest') || []));
        }
        patterns.push(...(this.commonPatterns.get('generic') || []));
        return patterns;
    }
    calculateSimilarity(str1, str2) {
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        if (s1 === s2)
            return 1.0;
        if (s1.includes(s2) || s2.includes(s1)) {
            const ratio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
            return Math.max(OperationSimilarityService.CONFIDENCE_THRESHOLDS.MIN_SUBSTRING, ratio);
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
        if (this.areCommonVariations(s1, s2)) {
            return Math.min(1.0, similarity + 0.2);
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
    areCommonVariations(str1, str2) {
        if (str1 === '' || str2 === '' || str1 === str2) {
            return false;
        }
        const commonPrefixes = ['get', 'set', 'create', 'delete', 'update', 'send', 'fetch'];
        const commonSuffixes = ['data', 'item', 'record', 'message', 'file', 'folder'];
        for (const prefix of commonPrefixes) {
            if ((str1.startsWith(prefix) && !str2.startsWith(prefix)) ||
                (!str1.startsWith(prefix) && str2.startsWith(prefix))) {
                const s1Clean = str1.startsWith(prefix) ? str1.slice(prefix.length) : str1;
                const s2Clean = str2.startsWith(prefix) ? str2.slice(prefix.length) : str2;
                if ((str1.startsWith(prefix) && s1Clean !== str1) || (str2.startsWith(prefix) && s2Clean !== str2)) {
                    if (s1Clean === s2Clean || this.levenshteinDistance(s1Clean, s2Clean) <= 2) {
                        return true;
                    }
                }
            }
        }
        for (const suffix of commonSuffixes) {
            if ((str1.endsWith(suffix) && !str2.endsWith(suffix)) ||
                (!str1.endsWith(suffix) && str2.endsWith(suffix))) {
                const s1Clean = str1.endsWith(suffix) ? str1.slice(0, -suffix.length) : str1;
                const s2Clean = str2.endsWith(suffix) ? str2.slice(0, -suffix.length) : str2;
                if ((str1.endsWith(suffix) && s1Clean !== str1) || (str2.endsWith(suffix) && s2Clean !== str2)) {
                    if (s1Clean === s2Clean || this.levenshteinDistance(s1Clean, s2Clean) <= 2) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    getSimilarityReason(confidence, invalid, valid) {
        const { VERY_HIGH, HIGH, MEDIUM } = OperationSimilarityService.CONFIDENCE_THRESHOLDS;
        if (confidence >= VERY_HIGH) {
            return 'Almost exact match - likely a typo';
        }
        else if (confidence >= HIGH) {
            return 'Very similar - common variation';
        }
        else if (confidence >= MEDIUM) {
            return 'Similar operation';
        }
        else if (invalid.includes(valid) || valid.includes(invalid)) {
            return 'Partial match';
        }
        else {
            return 'Possibly related operation';
        }
    }
    clearCache() {
        this.operationCache.clear();
        this.suggestionCache.clear();
    }
}
exports.OperationSimilarityService = OperationSimilarityService;
OperationSimilarityService.CACHE_DURATION_MS = 5 * 60 * 1000;
OperationSimilarityService.MIN_CONFIDENCE = 0.3;
OperationSimilarityService.MAX_SUGGESTIONS = 5;
OperationSimilarityService.MAX_NAME_LENGTH = 128;
OperationSimilarityService.MAX_CACHE_KEY_LENGTH = 512;
OperationSimilarityService.MAX_OPERATION_CACHE_ENTRIES = 500;
OperationSimilarityService.MAX_SUGGESTION_CACHE_ENTRIES = 100;
OperationSimilarityService.CONFIDENCE_THRESHOLDS = {
    EXACT: 1.0,
    VERY_HIGH: 0.95,
    HIGH: 0.8,
    MEDIUM: 0.6,
    MIN_SUBSTRING: 0.7
};
//# sourceMappingURL=operation-similarity-service.js.map