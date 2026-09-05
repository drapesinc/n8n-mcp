import { z } from 'zod';
import { WorkflowNode, WorkflowConnection, Workflow } from '../types/n8n-api';
export declare const workflowNodeSchema: z.ZodEffects<z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodString;
    typeVersion: z.ZodNumber;
    position: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    parameters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    credentials: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    disabled: z.ZodOptional<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodString>;
    notesInFlow: z.ZodOptional<z.ZodBoolean>;
    continueOnFail: z.ZodOptional<z.ZodBoolean>;
    onError: z.ZodOptional<z.ZodEnum<["continueRegularOutput", "continueErrorOutput", "stopWorkflow"]>>;
    retryOnFail: z.ZodOptional<z.ZodBoolean>;
    maxTries: z.ZodOptional<z.ZodNumber>;
    waitBetweenTries: z.ZodOptional<z.ZodNumber>;
    alwaysOutputData: z.ZodOptional<z.ZodBoolean>;
    executeOnce: z.ZodOptional<z.ZodBoolean>;
    webhookId: z.ZodOptional<z.ZodString>;
    customTelemetryTags: z.ZodOptional<z.ZodObject<{
        tag: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            value: string;
            key: string;
        }, {
            value: string;
            key: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        tag?: {
            value: string;
            key: string;
        }[] | undefined;
    }, {
        tag?: {
            value: string;
            key: string;
        }[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    name: string;
    id: string;
    typeVersion: number;
    position: [number, number];
    parameters: Record<string, unknown>;
    credentials?: Record<string, unknown> | undefined;
    customTelemetryTags?: {
        tag?: {
            value: string;
            key: string;
        }[] | undefined;
    } | undefined;
    disabled?: boolean | undefined;
    notes?: string | undefined;
    notesInFlow?: boolean | undefined;
    continueOnFail?: boolean | undefined;
    onError?: "continueRegularOutput" | "continueErrorOutput" | "stopWorkflow" | undefined;
    retryOnFail?: boolean | undefined;
    maxTries?: number | undefined;
    waitBetweenTries?: number | undefined;
    alwaysOutputData?: boolean | undefined;
    executeOnce?: boolean | undefined;
    webhookId?: string | undefined;
}, {
    type: string;
    name: string;
    id: string;
    typeVersion: number;
    position: [number, number];
    parameters: Record<string, unknown>;
    credentials?: Record<string, unknown> | undefined;
    customTelemetryTags?: {
        tag?: {
            value: string;
            key: string;
        }[] | undefined;
    } | undefined;
    disabled?: boolean | undefined;
    notes?: string | undefined;
    notesInFlow?: boolean | undefined;
    continueOnFail?: boolean | undefined;
    onError?: "continueRegularOutput" | "continueErrorOutput" | "stopWorkflow" | undefined;
    retryOnFail?: boolean | undefined;
    maxTries?: number | undefined;
    waitBetweenTries?: number | undefined;
    alwaysOutputData?: boolean | undefined;
    executeOnce?: boolean | undefined;
    webhookId?: string | undefined;
}>, {
    type: string;
    name: string;
    id: string;
    typeVersion: number;
    position: [number, number];
    parameters: Record<string, unknown>;
    credentials?: Record<string, unknown> | undefined;
    customTelemetryTags?: {
        tag?: {
            value: string;
            key: string;
        }[] | undefined;
    } | undefined;
    disabled?: boolean | undefined;
    notes?: string | undefined;
    notesInFlow?: boolean | undefined;
    continueOnFail?: boolean | undefined;
    onError?: "continueRegularOutput" | "continueErrorOutput" | "stopWorkflow" | undefined;
    retryOnFail?: boolean | undefined;
    maxTries?: number | undefined;
    waitBetweenTries?: number | undefined;
    alwaysOutputData?: boolean | undefined;
    executeOnce?: boolean | undefined;
    webhookId?: string | undefined;
}, unknown>;
export declare const WRITABLE_NODE_PROPERTIES: ReadonlySet<string>;
export declare function cleanNodeForApi(node: WorkflowNode): WorkflowNode;
export declare const workflowConnectionSchema: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodObject<{
    main: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    error: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_tool: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_languageModel: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_memory: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_embedding: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_vectorStore: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
}, "strip", z.ZodArray<z.ZodArray<z.ZodObject<{
    node: z.ZodString;
    type: z.ZodString;
    index: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: string;
    node: string;
    index: number;
}, {
    type: string;
    node: string;
    index: number;
}>, "many">, "many">, z.objectOutputType<{
    main: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    error: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_tool: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_languageModel: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_memory: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_embedding: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_vectorStore: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
}, z.ZodArray<z.ZodArray<z.ZodObject<{
    node: z.ZodString;
    type: z.ZodString;
    index: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: string;
    node: string;
    index: number;
}, {
    type: string;
    node: string;
    index: number;
}>, "many">, "many">, "strip">, z.objectInputType<{
    main: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    error: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_tool: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_languageModel: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_memory: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_embedding: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_vectorStore: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
}, z.ZodArray<z.ZodArray<z.ZodObject<{
    node: z.ZodString;
    type: z.ZodString;
    index: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: string;
    node: string;
    index: number;
}, {
    type: string;
    node: string;
    index: number;
}>, "many">, "many">, "strip">>>, Record<string, z.objectOutputType<{
    main: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    error: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_tool: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_languageModel: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_memory: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_embedding: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
    ai_vectorStore: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodObject<{
        node: z.ZodString;
        type: z.ZodString;
        index: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: string;
        node: string;
        index: number;
    }, {
        type: string;
        node: string;
        index: number;
    }>, "many">, "many">>;
}, z.ZodArray<z.ZodArray<z.ZodObject<{
    node: z.ZodString;
    type: z.ZodString;
    index: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: string;
    node: string;
    index: number;
}, {
    type: string;
    node: string;
    index: number;
}>, "many">, "many">, "strip">>, unknown>;
export declare const workflowSettingsSchema: z.ZodObject<{
    executionOrder: z.ZodDefault<z.ZodEnum<["v0", "v1"]>>;
    timezone: z.ZodOptional<z.ZodString>;
    saveDataErrorExecution: z.ZodDefault<z.ZodEnum<["all", "none"]>>;
    saveDataSuccessExecution: z.ZodDefault<z.ZodEnum<["all", "none"]>>;
    saveManualExecutions: z.ZodDefault<z.ZodBoolean>;
    saveExecutionProgress: z.ZodDefault<z.ZodBoolean>;
    executionTimeout: z.ZodOptional<z.ZodNumber>;
    errorWorkflow: z.ZodOptional<z.ZodString>;
    callerPolicy: z.ZodOptional<z.ZodEnum<["any", "none", "workflowsFromSameOwner", "workflowsFromAList"]>>;
    callerIds: z.ZodOptional<z.ZodString>;
    timeSavedMode: z.ZodOptional<z.ZodEnum<["fixed", "dynamic"]>>;
    timeSavedPerExecution: z.ZodOptional<z.ZodNumber>;
    redactionPolicy: z.ZodOptional<z.ZodEnum<["none", "non-manual", "manual-only", "all"]>>;
    availableInMCP: z.ZodOptional<z.ZodBoolean>;
    customTelemetryTags: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        key: string;
    }, {
        value: string;
        key: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    saveExecutionProgress: boolean;
    saveManualExecutions: boolean;
    saveDataErrorExecution: "all" | "none";
    saveDataSuccessExecution: "all" | "none";
    executionOrder: "v0" | "v1";
    executionTimeout?: number | undefined;
    errorWorkflow?: string | undefined;
    timezone?: string | undefined;
    callerPolicy?: "any" | "none" | "workflowsFromSameOwner" | "workflowsFromAList" | undefined;
    callerIds?: string | undefined;
    timeSavedPerExecution?: number | undefined;
    availableInMCP?: boolean | undefined;
    customTelemetryTags?: {
        value: string;
        key: string;
    }[] | undefined;
    redactionPolicy?: "all" | "none" | "non-manual" | "manual-only" | undefined;
    timeSavedMode?: "fixed" | "dynamic" | undefined;
}, {
    saveExecutionProgress?: boolean | undefined;
    saveManualExecutions?: boolean | undefined;
    saveDataErrorExecution?: "all" | "none" | undefined;
    saveDataSuccessExecution?: "all" | "none" | undefined;
    executionTimeout?: number | undefined;
    errorWorkflow?: string | undefined;
    timezone?: string | undefined;
    executionOrder?: "v0" | "v1" | undefined;
    callerPolicy?: "any" | "none" | "workflowsFromSameOwner" | "workflowsFromAList" | undefined;
    callerIds?: string | undefined;
    timeSavedPerExecution?: number | undefined;
    availableInMCP?: boolean | undefined;
    customTelemetryTags?: {
        value: string;
        key: string;
    }[] | undefined;
    redactionPolicy?: "all" | "none" | "non-manual" | "manual-only" | undefined;
    timeSavedMode?: "fixed" | "dynamic" | undefined;
}>;
export declare const defaultWorkflowSettings: {
    executionOrder: "v1";
    saveDataErrorExecution: "all";
    saveDataSuccessExecution: "all";
    saveManualExecutions: boolean;
    saveExecutionProgress: boolean;
};
export declare function validateWorkflowNode(node: unknown): WorkflowNode;
export declare function validateWorkflowConnections(connections: unknown): WorkflowConnection;
export declare function validateWorkflowSettings(settings: unknown): z.infer<typeof workflowSettingsSchema>;
export declare function cleanWorkflowForCreate(workflow: Partial<Workflow>): Partial<Workflow>;
export declare function cleanWorkflowForUpdate(workflow: Workflow): Partial<Workflow>;
export declare function validateWorkflowStructure(workflow: Partial<Workflow>): string[];
export declare function hasWebhookTrigger(workflow: Workflow): boolean;
export declare function validateConditionNodeStructure(node: WorkflowNode): string[];
export declare function validateFilterBasedNodeMetadata(node: WorkflowNode): string[];
export declare function validateOperatorStructure(operator: any, path: string): string[];
export declare function getWebhookUrl(workflow: Workflow): string | null;
export declare function getWorkflowStructureExample(): string;
export declare function getWorkflowFixSuggestions(errors: string[]): string[];
//# sourceMappingURL=n8n-validation.d.ts.map