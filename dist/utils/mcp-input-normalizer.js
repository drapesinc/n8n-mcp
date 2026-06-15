"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMcpJsonValue = normalizeMcpJsonValue;
exports.normalizeMcpWorkflowPosition = normalizeMcpWorkflowPosition;
exports.normalizeMcpWorkflowNode = normalizeMcpWorkflowNode;
exports.normalizeMcpWorkflowNodes = normalizeMcpWorkflowNodes;
exports.normalizeMcpWorkflowConnections = normalizeMcpWorkflowConnections;
const MAX_NORMALIZE_DEPTH = 256;
function isPlainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function tryParseJsonRoot(value) {
    if (typeof value !== 'string') {
        return value;
    }
    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
}
function isDenseIndexRecord(record) {
    const keys = Object.keys(record);
    if (keys.length === 0) {
        return false;
    }
    return keys.every((key) => /^(0|[1-9]\d*)$/.test(key))
        && keys
            .map(Number)
            .sort((a, b) => a - b)
            .every((key, index) => key === index);
}
function restoreIndexedArrays(value, depth = 0) {
    if (depth >= MAX_NORMALIZE_DEPTH) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((entry) => restoreIndexedArrays(entry, depth + 1));
    }
    if (!isPlainRecord(value)) {
        return value;
    }
    const normalizedEntries = Object.fromEntries(Object.entries(value).map(([key, entryValue]) => [key, restoreIndexedArrays(entryValue, depth + 1)]));
    if (isDenseIndexRecord(normalizedEntries)) {
        const { length } = Object.keys(normalizedEntries);
        return Array.from({ length }, (_, index) => normalizedEntries[String(index)]);
    }
    return normalizedEntries;
}
function normalizeMcpJsonValue(value) {
    return restoreIndexedArrays(tryParseJsonRoot(value));
}
function normalizeNumberLike(value) {
    if (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value)) {
        return value;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
}
function normalizeMcpWorkflowPosition(value) {
    const parsed = normalizeMcpJsonValue(value);
    if (!Array.isArray(parsed)) {
        return parsed;
    }
    return parsed.map(normalizeNumberLike);
}
function normalizeMcpWorkflowNode(value) {
    const parsed = tryParseJsonRoot(value);
    if (!isPlainRecord(parsed)) {
        return parsed;
    }
    const normalized = { ...parsed };
    if ('typeVersion' in parsed) {
        normalized.typeVersion = normalizeNumberLike(parsed.typeVersion);
    }
    if ('position' in parsed) {
        normalized.position = normalizeMcpWorkflowPosition(parsed.position);
    }
    if ('parameters' in parsed) {
        normalized.parameters = normalizeMcpJsonValue(parsed.parameters);
    }
    if ('credentials' in parsed) {
        normalized.credentials = tryParseJsonRoot(parsed.credentials);
    }
    return normalized;
}
function normalizeMcpWorkflowNodes(value) {
    const parsed = tryParseJsonRoot(value);
    const collection = isPlainRecord(parsed) && isDenseIndexRecord(parsed)
        ? Array.from({ length: Object.keys(parsed).length }, (_, index) => parsed[String(index)])
        : parsed;
    if (!Array.isArray(collection)) {
        return collection;
    }
    return collection.map(normalizeMcpWorkflowNode);
}
function normalizeMcpWorkflowConnections(value) {
    return normalizeMcpJsonValue(value);
}
//# sourceMappingURL=mcp-input-normalizer.js.map