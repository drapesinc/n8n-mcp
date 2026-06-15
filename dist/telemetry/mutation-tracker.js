"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mutationTracker = exports.MutationTracker = void 0;
const intent_classifier_js_1 = require("./intent-classifier.js");
const mutation_validator_js_1 = require("./mutation-validator.js");
const intent_sanitizer_js_1 = require("./intent-sanitizer.js");
const workflow_sanitizer_js_1 = require("./workflow-sanitizer.js");
const logger_js_1 = require("../utils/logger.js");
class MutationTracker {
    constructor() {
        this.recentMutations = [];
        this.RECENT_MUTATIONS_LIMIT = 100;
    }
    async processMutation(data, userId) {
        try {
            if (!this.validateMutationData(data)) {
                logger_js_1.logger.debug('Mutation data validation failed');
                return null;
            }
            const workflowBefore = workflow_sanitizer_js_1.WorkflowSanitizer.sanitizeWorkflowRaw(data.workflowBefore);
            const workflowAfter = workflow_sanitizer_js_1.WorkflowSanitizer.sanitizeWorkflowRaw(data.workflowAfter);
            const sanitizedOperations = workflow_sanitizer_js_1.WorkflowSanitizer.sanitizeTelemetryObject(data.operations);
            const sanitizedValidationBefore = workflow_sanitizer_js_1.WorkflowSanitizer.sanitizeTelemetryObject(data.validationBefore);
            const sanitizedValidationAfter = workflow_sanitizer_js_1.WorkflowSanitizer.sanitizeTelemetryObject(data.validationAfter);
            const sanitizedMutationError = workflow_sanitizer_js_1.WorkflowSanitizer.sanitizeTelemetryObject(data.mutationError);
            const sanitizedIntent = intent_sanitizer_js_1.intentSanitizer.sanitize(data.userIntent);
            if (mutation_validator_js_1.mutationValidator.shouldExclude(data)) {
                logger_js_1.logger.debug('Mutation excluded from tracking based on quality criteria');
                return null;
            }
            if (mutation_validator_js_1.mutationValidator.isDuplicate(workflowBefore, workflowAfter, data.operations, this.recentMutations)) {
                logger_js_1.logger.debug('Duplicate mutation detected, skipping tracking');
                return null;
            }
            const hashBefore = mutation_validator_js_1.mutationValidator.hashWorkflow(workflowBefore);
            const hashAfter = mutation_validator_js_1.mutationValidator.hashWorkflow(workflowAfter);
            const structureHashBefore = workflow_sanitizer_js_1.WorkflowSanitizer.generateWorkflowHash(workflowBefore);
            const structureHashAfter = workflow_sanitizer_js_1.WorkflowSanitizer.generateWorkflowHash(workflowAfter);
            const intentClassification = intent_classifier_js_1.intentClassifier.classify(data.operations, sanitizedIntent);
            const changeMetrics = this.calculateChangeMetrics(data.operations);
            const validationMetrics = this.calculateValidationMetrics(data.validationBefore, data.validationAfter);
            const record = {
                userId,
                sessionId: data.sessionId,
                workflowBefore,
                workflowAfter,
                workflowHashBefore: hashBefore,
                workflowHashAfter: hashAfter,
                workflowStructureHashBefore: structureHashBefore,
                workflowStructureHashAfter: structureHashAfter,
                userIntent: sanitizedIntent,
                intentClassification,
                toolName: data.toolName,
                operations: sanitizedOperations,
                operationCount: data.operations.length,
                operationTypes: this.extractOperationTypes(data.operations),
                validationBefore: sanitizedValidationBefore,
                validationAfter: sanitizedValidationAfter,
                ...validationMetrics,
                ...changeMetrics,
                mutationSuccess: data.mutationSuccess,
                mutationError: sanitizedMutationError,
                durationMs: data.durationMs,
            };
            this.addToRecentMutations(hashBefore, hashAfter, data.operations);
            return record;
        }
        catch (error) {
            logger_js_1.logger.error('Error processing mutation:', error);
            return null;
        }
    }
    validateMutationData(data) {
        const validationResult = mutation_validator_js_1.mutationValidator.validate(data);
        if (!validationResult.valid) {
            logger_js_1.logger.warn('Mutation data validation failed:', validationResult.errors);
            return false;
        }
        if (validationResult.warnings.length > 0) {
            logger_js_1.logger.debug('Mutation data validation warnings:', validationResult.warnings);
        }
        return true;
    }
    calculateChangeMetrics(operations) {
        const metrics = {
            nodesAdded: 0,
            nodesRemoved: 0,
            nodesModified: 0,
            connectionsAdded: 0,
            connectionsRemoved: 0,
            propertiesChanged: 0,
        };
        for (const op of operations) {
            switch (op.type) {
                case 'addNode':
                    metrics.nodesAdded++;
                    break;
                case 'removeNode':
                    metrics.nodesRemoved++;
                    break;
                case 'updateNode':
                    metrics.nodesModified++;
                    if ('updates' in op && op.updates) {
                        metrics.propertiesChanged += Object.keys(op.updates).length;
                    }
                    break;
                case 'addConnection':
                    metrics.connectionsAdded++;
                    break;
                case 'removeConnection':
                    metrics.connectionsRemoved++;
                    break;
                case 'rewireConnection':
                    metrics.connectionsRemoved++;
                    metrics.connectionsAdded++;
                    break;
                case 'replaceConnections':
                    if ('connections' in op && op.connections) {
                        metrics.connectionsRemoved++;
                        metrics.connectionsAdded++;
                    }
                    break;
                case 'updateSettings':
                    if ('settings' in op && op.settings) {
                        metrics.propertiesChanged += Object.keys(op.settings).length;
                    }
                    break;
                case 'moveNode':
                case 'enableNode':
                case 'disableNode':
                case 'updateName':
                case 'addTag':
                case 'removeTag':
                case 'activateWorkflow':
                case 'deactivateWorkflow':
                case 'cleanStaleConnections':
                    metrics.propertiesChanged++;
                    break;
            }
        }
        return metrics;
    }
    calculateValidationMetrics(validationBefore, validationAfter) {
        if (!validationBefore || !validationAfter) {
            return {
                validationImproved: null,
                errorsResolved: 0,
                errorsIntroduced: 0,
            };
        }
        const errorsBefore = validationBefore.errors?.length || 0;
        const errorsAfter = validationAfter.errors?.length || 0;
        const errorsResolved = Math.max(0, errorsBefore - errorsAfter);
        const errorsIntroduced = Math.max(0, errorsAfter - errorsBefore);
        const validationImproved = errorsBefore > errorsAfter;
        return {
            validationImproved,
            errorsResolved,
            errorsIntroduced,
        };
    }
    extractOperationTypes(operations) {
        const types = new Set(operations.map((op) => op.type));
        return Array.from(types);
    }
    addToRecentMutations(hashBefore, hashAfter, operations) {
        this.recentMutations.push({ hashBefore, hashAfter, operations });
        if (this.recentMutations.length > this.RECENT_MUTATIONS_LIMIT) {
            this.recentMutations.shift();
        }
    }
    clearRecentMutations() {
        this.recentMutations = [];
    }
    getRecentMutationsCount() {
        return this.recentMutations.length;
    }
}
exports.MutationTracker = MutationTracker;
exports.mutationTracker = new MutationTracker();
//# sourceMappingURL=mutation-tracker.js.map