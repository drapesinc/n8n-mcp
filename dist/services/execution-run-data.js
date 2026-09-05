"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractConnectionBranches = extractConnectionBranches;
exports.mergeRunBranches = mergeRunBranches;
exports.sampleRunItems = sampleRunItems;
exports.countRunItems = countRunItems;
exports.firstRunItem = firstRunItem;
exports.hasRunOutputData = hasRunOutputData;
exports.latestStartTime = latestStartTime;
exports.totalExecutionTime = totalExecutionTime;
exports.getRunError = getRunError;
function branchesByType(connections) {
    if (!connections || typeof connections !== 'object')
        return [];
    const grouped = [];
    for (const [type, value] of Object.entries(connections)) {
        if (!Array.isArray(value))
            continue;
        grouped.push([type, value.map(branch => (Array.isArray(branch) ? branch : null))]);
    }
    return grouped;
}
function extractConnectionBranches(connections) {
    return branchesByType(connections).flatMap(([, branches]) => branches);
}
function mergeRunBranches(nodeData, field = 'data', maxPerBranch = -1) {
    if (!Array.isArray(nodeData))
        return [];
    const byType = new Map();
    for (const run of nodeData) {
        for (const [type, branches] of branchesByType(run?.[field])) {
            let merged = byType.get(type);
            if (!merged) {
                merged = [];
                byType.set(type, merged);
            }
            branches.forEach((items, index) => {
                while (merged.length <= index)
                    merged.push(null);
                if (items === null)
                    return;
                let target = merged[index];
                if (!Array.isArray(target)) {
                    target = [];
                    merged[index] = target;
                }
                const room = maxPerBranch < 0 ? items.length : Math.max(0, maxPerBranch - target.length);
                for (let i = 0; i < room && i < items.length; i++)
                    target.push(items[i]);
            });
        }
    }
    return [...byType.values()].flat();
}
function sampleRunItems(nodeData, maxItems = -1) {
    return mergeRunBranches(nodeData, 'data', maxItems).find(branch => branch && branch.length > 0) ?? [];
}
function countRunItems(nodeData) {
    if (!Array.isArray(nodeData))
        return 0;
    let count = 0;
    for (const run of nodeData) {
        for (const branch of extractConnectionBranches(run?.data))
            count += branch?.length ?? 0;
    }
    return count;
}
function firstRunItem(nodeData, field = 'data') {
    if (!Array.isArray(nodeData))
        return undefined;
    for (const run of nodeData) {
        for (const branch of extractConnectionBranches(run?.[field])) {
            if (branch && branch.length > 0)
                return branch[0];
        }
    }
    return undefined;
}
function hasRunOutputData(nodeData) {
    if (!Array.isArray(nodeData))
        return false;
    return nodeData.some(run => extractConnectionBranches(run?.data).some(Array.isArray));
}
function latestStartTime(nodeData) {
    if (!Array.isArray(nodeData))
        return 0;
    let latest = 0;
    for (const run of nodeData) {
        if (typeof run?.startTime === 'number' && run.startTime > latest)
            latest = run.startTime;
    }
    return latest;
}
function totalExecutionTime(nodeData) {
    if (!Array.isArray(nodeData))
        return undefined;
    let total;
    for (const run of nodeData) {
        if (typeof run?.executionTime === 'number')
            total = (total ?? 0) + run.executionTime;
    }
    return total;
}
function getRunError(nodeData) {
    if (!Array.isArray(nodeData))
        return undefined;
    let found;
    for (const run of nodeData) {
        if (run?.error) {
            found = run.error;
        }
    }
    return found;
}
//# sourceMappingURL=execution-run-data.js.map