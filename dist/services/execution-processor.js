"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePreview = generatePreview;
exports.filterExecutionData = filterExecutionData;
exports.processExecution = processExecution;
const logger_1 = require("../utils/logger");
const error_execution_processor_1 = require("./error-execution-processor");
const execution_run_data_1 = require("./execution-run-data");
const THRESHOLDS = {
    CHAR_SIZE_BYTES: 2,
    OVERHEAD_PER_OBJECT: 50,
    MAX_RECOMMENDED_SIZE_KB: 100,
    SMALL_DATASET_ITEMS: 20,
    MODERATE_DATASET_ITEMS: 50,
    MODERATE_DATASET_SIZE_KB: 200,
    MAX_DEPTH: 3,
    MAX_ITEMS_LIMIT: 1000,
};
function extractErrorMessage(error) {
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') {
            return error.message;
        }
        if ('error' in error && typeof error.error === 'string') {
            return error.error;
        }
    }
    return 'Unknown error';
}
function extractStructure(data, maxDepth = THRESHOLDS.MAX_DEPTH, currentDepth = 0) {
    if (currentDepth >= maxDepth) {
        return typeof data;
    }
    if (data === null || data === undefined) {
        return 'null';
    }
    if (Array.isArray(data)) {
        if (data.length === 0) {
            return [];
        }
        return [extractStructure(data[0], maxDepth, currentDepth + 1)];
    }
    if (typeof data === 'object') {
        const structure = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                structure[key] = extractStructure(data[key], maxDepth, currentDepth + 1);
            }
        }
        return structure;
    }
    return typeof data;
}
function estimateDataSize(data) {
    try {
        const jsonString = JSON.stringify(data);
        const sizeBytes = jsonString.length * THRESHOLDS.CHAR_SIZE_BYTES;
        return Math.ceil(sizeBytes / 1024);
    }
    catch (error) {
        logger_1.logger.warn('Failed to estimate data size', { error });
        return 0;
    }
}
function countItems(nodeData) {
    const counts = { input: 0, output: 0 };
    if (!nodeData || !Array.isArray(nodeData)) {
        return counts;
    }
    for (const run of nodeData) {
        for (const output of (0, execution_run_data_1.extractConnectionBranches)(run?.data)) {
            counts.output += output?.length ?? 0;
        }
        for (const input of (0, execution_run_data_1.extractConnectionBranches)(run?.inputOverride)) {
            counts.input += input?.length ?? 0;
        }
    }
    return counts;
}
function generatePreview(execution) {
    const preview = {
        totalNodes: 0,
        executedNodes: 0,
        estimatedSizeKB: 0,
        nodes: {},
    };
    if (!execution.data?.resultData?.runData) {
        return {
            preview,
            recommendation: {
                canFetchFull: true,
                suggestedMode: 'summary',
                reason: 'No execution data available',
            },
        };
    }
    const runData = execution.data.resultData.runData;
    const nodeNames = Object.keys(runData);
    preview.totalNodes = nodeNames.length;
    let totalItemsOutput = 0;
    let largestNodeItems = 0;
    for (const nodeName of nodeNames) {
        const nodeData = runData[nodeName];
        const itemCounts = countItems(nodeData);
        let dataStructure = {};
        const firstItem = (0, execution_run_data_1.firstRunItem)(nodeData);
        if (firstItem) {
            dataStructure = extractStructure(firstItem);
        }
        const nodeSize = estimateDataSize(nodeData);
        const nodePreview = {
            status: 'success',
            itemCounts,
            dataStructure,
            estimatedSizeKB: nodeSize,
        };
        const runError = (0, execution_run_data_1.getRunError)(nodeData);
        if (runError) {
            nodePreview.status = 'error';
            nodePreview.error = extractErrorMessage(runError);
        }
        preview.nodes[nodeName] = nodePreview;
        preview.estimatedSizeKB += nodeSize;
        preview.executedNodes++;
        totalItemsOutput += itemCounts.output;
        largestNodeItems = Math.max(largestNodeItems, itemCounts.output);
    }
    const recommendation = generateRecommendation(preview.estimatedSizeKB, totalItemsOutput, largestNodeItems);
    return { preview, recommendation };
}
function generateRecommendation(totalSizeKB, totalItems, largestNodeItems) {
    if (totalSizeKB <= THRESHOLDS.MAX_RECOMMENDED_SIZE_KB && totalItems <= THRESHOLDS.SMALL_DATASET_ITEMS) {
        return {
            canFetchFull: true,
            suggestedMode: 'full',
            reason: `Small dataset (${totalSizeKB}KB, ${totalItems} items). Safe to fetch full data.`,
        };
    }
    if (totalSizeKB <= THRESHOLDS.MODERATE_DATASET_SIZE_KB && totalItems <= THRESHOLDS.MODERATE_DATASET_ITEMS) {
        return {
            canFetchFull: false,
            suggestedMode: 'summary',
            suggestedItemsLimit: 2,
            reason: `Moderate dataset (${totalSizeKB}KB, ${totalItems} items). Summary mode recommended.`,
        };
    }
    const suggestedLimit = Math.max(1, Math.min(5, Math.floor(100 / largestNodeItems)));
    return {
        canFetchFull: false,
        suggestedMode: 'filtered',
        suggestedItemsLimit: suggestedLimit,
        reason: `Large dataset (${totalSizeKB}KB, ${totalItems} items). Use filtered mode with itemsLimit: ${suggestedLimit}.`,
    };
}
function truncateItems(items, limit, knownTotal) {
    if (!Array.isArray(items) || items.length === 0) {
        return {
            truncated: items || [],
            metadata: {
                totalItems: knownTotal ?? 0,
                itemsShown: 0,
                truncated: (knownTotal ?? 0) > 0,
            },
        };
    }
    let totalItems = knownTotal ?? 0;
    if (knownTotal === undefined) {
        for (const output of items) {
            if (Array.isArray(output)) {
                totalItems += output.length;
            }
        }
    }
    if (limit === 0) {
        const structureOnly = items.map(output => {
            if (output === null)
                return null;
            if (!Array.isArray(output) || output.length === 0) {
                return [];
            }
            return [extractStructure(output[0])];
        });
        return {
            truncated: structureOnly,
            metadata: {
                totalItems,
                itemsShown: 0,
                truncated: totalItems > 0,
            },
        };
    }
    if (limit < 0) {
        return {
            truncated: items,
            metadata: {
                totalItems,
                itemsShown: totalItems,
                truncated: false,
            },
        };
    }
    const result = [];
    let itemsShown = 0;
    for (const output of items) {
        if (!Array.isArray(output)) {
            result.push(output);
            continue;
        }
        if (itemsShown >= limit) {
            break;
        }
        const remaining = limit - itemsShown;
        const toTake = Math.min(remaining, output.length);
        result.push(output.slice(0, toTake));
        itemsShown += toTake;
    }
    return {
        truncated: result,
        metadata: {
            totalItems,
            itemsShown,
            truncated: itemsShown < totalItems,
        },
    };
}
function filterExecutionData(execution, options, workflow) {
    const mode = options.mode || 'summary';
    let itemsLimit = options.itemsLimit !== undefined ? options.itemsLimit : 2;
    if (itemsLimit !== -1) {
        if (itemsLimit < 0) {
            logger_1.logger.warn('Invalid itemsLimit, defaulting to 2', { provided: itemsLimit });
            itemsLimit = 2;
        }
        if (itemsLimit > THRESHOLDS.MAX_ITEMS_LIMIT) {
            logger_1.logger.warn(`itemsLimit capped at ${THRESHOLDS.MAX_ITEMS_LIMIT}`, { provided: itemsLimit });
            itemsLimit = THRESHOLDS.MAX_ITEMS_LIMIT;
        }
    }
    const includeInputData = options.includeInputData || false;
    const nodeNamesFilter = options.nodeNames;
    const duration = execution.stoppedAt && execution.startedAt
        ? new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime()
        : undefined;
    const response = {
        id: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        mode,
        startedAt: execution.startedAt,
        stoppedAt: execution.stoppedAt,
        duration,
        finished: execution.finished,
    };
    if (mode === 'preview') {
        const { preview, recommendation } = generatePreview(execution);
        response.preview = preview;
        response.recommendation = recommendation;
        return response;
    }
    if (mode === 'error') {
        const errorAnalysis = (0, error_execution_processor_1.processErrorExecution)(execution, {
            itemsLimit: options.errorItemsLimit ?? 2,
            includeStackTrace: options.includeStackTrace ?? false,
            includeExecutionPath: options.includeExecutionPath !== false,
            workflow
        });
        const runData = execution.data?.resultData?.runData || {};
        const executedNodes = Object.keys(runData).length;
        response.errorInfo = errorAnalysis;
        response.summary = {
            totalNodes: executedNodes,
            executedNodes,
            totalItems: 0,
            hasMoreData: false
        };
        if (execution.data?.resultData?.error) {
            response.error = execution.data.resultData.error;
        }
        return response;
    }
    if (!execution.data?.resultData?.runData) {
        response.summary = {
            totalNodes: 0,
            executedNodes: 0,
            totalItems: 0,
            hasMoreData: false,
        };
        response.nodes = {};
        if (execution.data?.resultData?.error) {
            response.error = execution.data.resultData.error;
        }
        return response;
    }
    const runData = execution.data.resultData.runData;
    let nodeNames = Object.keys(runData);
    if (nodeNamesFilter && nodeNamesFilter.length > 0) {
        nodeNames = nodeNames.filter(name => nodeNamesFilter.includes(name));
    }
    const processedNodes = {};
    let totalItems = 0;
    let hasMoreData = false;
    for (const nodeName of nodeNames) {
        const nodeData = runData[nodeName];
        if (!Array.isArray(nodeData) || nodeData.length === 0) {
            processedNodes[nodeName] = {
                itemsInput: 0,
                itemsOutput: 0,
                status: 'success',
            };
            continue;
        }
        const itemCounts = countItems(nodeData);
        totalItems += itemCounts.output;
        const nodeResult = {
            executionTime: (0, execution_run_data_1.totalExecutionTime)(nodeData),
            itemsInput: itemCounts.input,
            itemsOutput: itemCounts.output,
            status: 'success',
        };
        const runError = (0, execution_run_data_1.getRunError)(nodeData);
        if (runError) {
            nodeResult.status = 'error';
            nodeResult.error = extractErrorMessage(runError);
        }
        const maxPerBranch = mode === 'full' || itemsLimit < 0 ? -1 : Math.max(itemsLimit, 1);
        const outputData = (0, execution_run_data_1.mergeRunBranches)(nodeData, 'data', maxPerBranch);
        if (mode === 'full') {
            nodeResult.data = {
                output: outputData,
                metadata: {
                    totalItems: itemCounts.output,
                    itemsShown: itemCounts.output,
                    truncated: false,
                },
            };
        }
        else {
            const { truncated, metadata } = truncateItems(outputData, itemsLimit, itemCounts.output);
            if (metadata.truncated) {
                hasMoreData = true;
            }
            nodeResult.data = {
                output: truncated,
                metadata,
            };
        }
        if (includeInputData && itemCounts.input > 0) {
            const inputData = (0, execution_run_data_1.mergeRunBranches)(nodeData, 'inputOverride', maxPerBranch);
            if (mode === 'full') {
                nodeResult.data.input = inputData;
            }
            else {
                const { truncated, metadata } = truncateItems(inputData, itemsLimit, itemCounts.input);
                if (metadata.truncated) {
                    hasMoreData = true;
                }
                nodeResult.data.input = truncated;
                nodeResult.data.inputMetadata = metadata;
            }
        }
        processedNodes[nodeName] = nodeResult;
    }
    response.summary = {
        totalNodes: Object.keys(runData).length,
        executedNodes: nodeNames.length,
        totalItems,
        hasMoreData,
    };
    response.nodes = processedNodes;
    if (execution.data?.resultData?.error) {
        response.error = execution.data.resultData.error;
    }
    return response;
}
function processExecution(execution, options = {}, workflow) {
    if (!options.mode && !options.nodeNames && options.itemsLimit === undefined) {
        return execution;
    }
    return filterExecutionData(execution, options, workflow);
}
//# sourceMappingURL=execution-processor.js.map