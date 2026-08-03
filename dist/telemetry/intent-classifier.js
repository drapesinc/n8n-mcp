"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intentClassifier = exports.IntentClassifier = void 0;
const mutation_types_js_1 = require("./mutation-types.js");
class IntentClassifier {
    classify(operations, userIntent) {
        if (operations.length === 0) {
            return mutation_types_js_1.IntentClassification.UNKNOWN;
        }
        if (userIntent) {
            const textClassification = this.classifyFromText(userIntent);
            if (textClassification !== mutation_types_js_1.IntentClassification.UNKNOWN) {
                return textClassification;
            }
        }
        return this.classifyFromOperations(operations);
    }
    classifyFromText(intent) {
        const lowerIntent = intent.toLowerCase();
        if (lowerIntent.includes('fix') ||
            lowerIntent.includes('resolve') ||
            lowerIntent.includes('correct') ||
            lowerIntent.includes('repair') ||
            lowerIntent.includes('error')) {
            return mutation_types_js_1.IntentClassification.FIX_VALIDATION;
        }
        if (lowerIntent.includes('add') ||
            lowerIntent.includes('create') ||
            lowerIntent.includes('insert') ||
            lowerIntent.includes('new node')) {
            return mutation_types_js_1.IntentClassification.ADD_FUNCTIONALITY;
        }
        if (lowerIntent.includes('update') ||
            lowerIntent.includes('change') ||
            lowerIntent.includes('modify') ||
            lowerIntent.includes('configure') ||
            lowerIntent.includes('set')) {
            return mutation_types_js_1.IntentClassification.MODIFY_CONFIGURATION;
        }
        if (lowerIntent.includes('connect') ||
            lowerIntent.includes('reconnect') ||
            lowerIntent.includes('rewire') ||
            lowerIntent.includes('reroute') ||
            lowerIntent.includes('link')) {
            return mutation_types_js_1.IntentClassification.REWIRE_LOGIC;
        }
        if (lowerIntent.includes('remove') ||
            lowerIntent.includes('delete') ||
            lowerIntent.includes('clean') ||
            lowerIntent.includes('disable')) {
            return mutation_types_js_1.IntentClassification.CLEANUP;
        }
        return mutation_types_js_1.IntentClassification.UNKNOWN;
    }
    classifyFromOperations(operations) {
        const opTypes = operations.map((op) => op.type);
        const opTypeSet = new Set(opTypes);
        if (opTypeSet.has('addNode') && opTypeSet.has('addConnection')) {
            return mutation_types_js_1.IntentClassification.ADD_FUNCTIONALITY;
        }
        if (opTypeSet.has('addNode') && !opTypeSet.has('removeNode')) {
            return mutation_types_js_1.IntentClassification.ADD_FUNCTIONALITY;
        }
        if (opTypeSet.has('removeNode') || opTypeSet.has('removeConnection')) {
            return mutation_types_js_1.IntentClassification.CLEANUP;
        }
        if (opTypeSet.has('disableNode')) {
            return mutation_types_js_1.IntentClassification.CLEANUP;
        }
        if (opTypeSet.has('rewireConnection') ||
            opTypeSet.has('replaceConnections') ||
            (opTypeSet.has('addConnection') && opTypeSet.has('removeConnection'))) {
            return mutation_types_js_1.IntentClassification.REWIRE_LOGIC;
        }
        if (opTypeSet.has('updateNode') && opTypes.every((t) => t === 'updateNode')) {
            return mutation_types_js_1.IntentClassification.MODIFY_CONFIGURATION;
        }
        if (opTypeSet.has('updateSettings') ||
            opTypeSet.has('updateName') ||
            opTypeSet.has('setNodeGroups') ||
            opTypeSet.has('addTag') ||
            opTypeSet.has('removeTag')) {
            return mutation_types_js_1.IntentClassification.MODIFY_CONFIGURATION;
        }
        if (opTypeSet.has('updateNode')) {
            return mutation_types_js_1.IntentClassification.MODIFY_CONFIGURATION;
        }
        if (opTypeSet.has('moveNode')) {
            return mutation_types_js_1.IntentClassification.MODIFY_CONFIGURATION;
        }
        if (opTypeSet.has('enableNode')) {
            return mutation_types_js_1.IntentClassification.FIX_VALIDATION;
        }
        if (opTypeSet.has('cleanStaleConnections')) {
            return mutation_types_js_1.IntentClassification.CLEANUP;
        }
        return mutation_types_js_1.IntentClassification.UNKNOWN;
    }
    getConfidence(classification, operations, userIntent) {
        if (userIntent && this.classifyFromText(userIntent) === classification) {
            return 0.9;
        }
        if (classification !== mutation_types_js_1.IntentClassification.UNKNOWN) {
            const opTypes = new Set(operations.map((op) => op.type));
            if (classification === mutation_types_js_1.IntentClassification.ADD_FUNCTIONALITY &&
                opTypes.has('addNode')) {
                return 0.8;
            }
            if (classification === mutation_types_js_1.IntentClassification.CLEANUP &&
                (opTypes.has('removeNode') || opTypes.has('removeConnection'))) {
                return 0.8;
            }
            if (classification === mutation_types_js_1.IntentClassification.REWIRE_LOGIC &&
                opTypes.has('rewireConnection')) {
                return 0.8;
            }
            return 0.6;
        }
        return 0.3;
    }
    getDescription(classification) {
        switch (classification) {
            case mutation_types_js_1.IntentClassification.ADD_FUNCTIONALITY:
                return 'Adding new nodes or functionality to the workflow';
            case mutation_types_js_1.IntentClassification.MODIFY_CONFIGURATION:
                return 'Modifying configuration of existing nodes';
            case mutation_types_js_1.IntentClassification.REWIRE_LOGIC:
                return 'Changing workflow execution flow by rewiring connections';
            case mutation_types_js_1.IntentClassification.FIX_VALIDATION:
                return 'Fixing validation errors or issues';
            case mutation_types_js_1.IntentClassification.CLEANUP:
                return 'Removing or disabling nodes and connections';
            case mutation_types_js_1.IntentClassification.UNKNOWN:
                return 'Unknown or complex mutation pattern';
            default:
                return 'Unclassified mutation';
        }
    }
}
exports.IntentClassifier = IntentClassifier;
exports.intentClassifier = new IntentClassifier();
//# sourceMappingURL=intent-classifier.js.map