"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstanceCacheStatistics = getInstanceCacheStatistics;
exports.getInstanceCacheMetrics = getInstanceCacheMetrics;
exports.clearInstanceCache = clearInstanceCache;
exports.getN8nApiClient = getN8nApiClient;
exports.tryParseJson = tryParseJson;
exports.handleCreateWorkflow = handleCreateWorkflow;
exports.handleGetWorkflow = handleGetWorkflow;
exports.handleGetWorkflowDetails = handleGetWorkflowDetails;
exports.handleGetWorkflowStructure = handleGetWorkflowStructure;
exports.handleGetWorkflowMinimal = handleGetWorkflowMinimal;
exports.handleGetWorkflowFiltered = handleGetWorkflowFiltered;
exports.handleGetWorkflowActive = handleGetWorkflowActive;
exports.handleUpdateWorkflow = handleUpdateWorkflow;
exports.handleDeleteWorkflow = handleDeleteWorkflow;
exports.handleActivateWorkflow = handleActivateWorkflow;
exports.handleListWorkflows = handleListWorkflows;
exports.handleValidateWorkflow = handleValidateWorkflow;
exports.handleAutofixWorkflow = handleAutofixWorkflow;
exports.handleTestWorkflow = handleTestWorkflow;
exports.handleGetExecution = handleGetExecution;
exports.handleListExecutions = handleListExecutions;
exports.handleDeleteExecution = handleDeleteExecution;
exports.handleListTestRuns = handleListTestRuns;
exports.handleGetTestRun = handleGetTestRun;
exports.handleListTestCases = handleListTestCases;
exports.handleTriggerTestRun = handleTriggerTestRun;
exports.handleCancelTestRun = handleCancelTestRun;
exports.handleHealthCheck = handleHealthCheck;
exports.handleDiagnostic = handleDiagnostic;
exports.handleWorkflowVersions = handleWorkflowVersions;
exports.handleDeployTemplate = handleDeployTemplate;
exports.handleTriggerWebhookWorkflow = handleTriggerWebhookWorkflow;
exports.handleCreateTable = handleCreateTable;
exports.handleListTables = handleListTables;
exports.handleGetTable = handleGetTable;
exports.handleUpdateTable = handleUpdateTable;
exports.handleDeleteTable = handleDeleteTable;
exports.handleGetRows = handleGetRows;
exports.handleInsertRows = handleInsertRows;
exports.handleUpdateRows = handleUpdateRows;
exports.handleUpsertRows = handleUpsertRows;
exports.handleDeleteRows = handleDeleteRows;
exports.handleAddColumn = handleAddColumn;
exports.handleDeleteColumn = handleDeleteColumn;
exports.handleRenameColumn = handleRenameColumn;
exports.handleListCredentials = handleListCredentials;
exports.handleGetCredential = handleGetCredential;
exports.handleCreateCredential = handleCreateCredential;
exports.handleUpdateCredential = handleUpdateCredential;
exports.handleDeleteCredential = handleDeleteCredential;
exports.handleGetCredentialSchema = handleGetCredentialSchema;
exports.handleCreateFolder = handleCreateFolder;
exports.handleListFolders = handleListFolders;
exports.handleGetFolder = handleGetFolder;
exports.handleRenameFolder = handleRenameFolder;
exports.handleMoveFolder = handleMoveFolder;
exports.handleDeleteFolder = handleDeleteFolder;
exports.handleAuditInstance = handleAuditInstance;
const crypto_1 = require("crypto");
const n8n_api_client_1 = require("../services/n8n-api-client");
const workflow_security_scanner_1 = require("../services/workflow-security-scanner");
const audit_report_builder_1 = require("../services/audit-report-builder");
const n8n_api_1 = require("../config/n8n-api");
const n8n_api_2 = require("../types/n8n-api");
const n8n_validation_1 = require("../services/n8n-validation");
const node_groups_1 = require("../services/node-groups");
const n8n_version_1 = require("../services/n8n-version");
const n8n_errors_1 = require("../utils/n8n-errors");
const logger_1 = require("../utils/logger");
const zod_1 = require("zod");
const workflow_validator_1 = require("../services/workflow-validator");
const enhanced_config_validator_1 = require("../services/enhanced-config-validator");
const instance_context_1 = require("../types/instance-context");
const workflow_auto_fixer_1 = require("../services/workflow-auto-fixer");
const expression_format_validator_1 = require("../services/expression-format-validator");
const workflow_versioning_service_1 = require("../services/workflow-versioning-service");
const handlers_workflow_diff_1 = require("./handlers-workflow-diff");
const telemetry_1 = require("../telemetry");
const cache_utils_1 = require("../utils/cache-utils");
const execution_processor_1 = require("../services/execution-processor");
const npm_version_checker_1 = require("../utils/npm-version-checker");
const workspace_api_client_1 = require("../services/workspace-api-client");
const mcp_input_normalizer_1 = require("../utils/mcp-input-normalizer");
const official_mcp_access_1 = require("./official-mcp-access");
const handlers_official_tools_1 = require("./handlers-official-tools");
const mcp_exposure_1 = require("../services/mcp-exposure");
const tool_policy_1 = require("./tool-policy");
const agents_action_map_1 = require("./agents-action-map");
let defaultApiClient = null;
let lastDefaultConfigUrl = null;
const cacheMutex = new cache_utils_1.CacheMutex();
const instanceClients = (0, cache_utils_1.createInstanceCache)((client, key) => {
    logger_1.logger.debug('Evicting API client from cache', {
        cacheKey: key.substring(0, 8) + '...'
    });
});
function getInstanceCacheStatistics() {
    return (0, cache_utils_1.getCacheStatistics)();
}
function getInstanceCacheMetrics() {
    return cache_utils_1.cacheMetrics.getMetrics();
}
function clearInstanceCache() {
    instanceClients.clear();
    cache_utils_1.cacheMetrics.recordClear();
    cache_utils_1.cacheMetrics.updateSize(0, instanceClients.max);
}
function getN8nApiClient(context) {
    if (context?.n8nApiUrl && context?.n8nApiKey) {
        const validation = (0, instance_context_1.validateInstanceContext)(context);
        if (!validation.valid) {
            logger_1.logger.warn('Invalid instance context provided', {
                instanceId: context.instanceId,
                errors: validation.errors
            });
            return null;
        }
        const cacheKey = (0, cache_utils_1.createCacheKey)(`${context.n8nApiUrl}:${context.n8nApiKey}:${context.instanceId || ''}`);
        if (instanceClients.has(cacheKey)) {
            cache_utils_1.cacheMetrics.recordHit();
            return instanceClients.get(cacheKey) || null;
        }
        cache_utils_1.cacheMetrics.recordMiss();
        if (cacheMutex.isLocked(cacheKey)) {
            const waitTime = 100;
            const start = Date.now();
            while (cacheMutex.isLocked(cacheKey) && (Date.now() - start) < 1000) {
            }
            if (instanceClients.has(cacheKey)) {
                cache_utils_1.cacheMetrics.recordHit();
                return instanceClients.get(cacheKey) || null;
            }
        }
        const config = (0, n8n_api_1.getN8nApiConfigFromContext)(context);
        if (config) {
            logger_1.logger.info('Creating instance-specific n8n API client', {
                url: config.baseUrl.replace(/^(https?:\/\/[^\/]+).*/, '$1'),
                instanceId: context.instanceId,
                cacheKey: cacheKey.substring(0, 8) + '...'
            });
            const client = new n8n_api_client_1.N8nApiClient(config);
            instanceClients.set(cacheKey, client);
            cache_utils_1.cacheMetrics.recordSet();
            cache_utils_1.cacheMetrics.updateSize(instanceClients.size, instanceClients.max);
            return client;
        }
        return null;
    }
    if (process.env.ENABLE_MULTI_TENANT === 'true') {
        logger_1.logger.warn('Refusing env-credential fallback in multi-tenant mode');
        return null;
    }
    logger_1.logger.info('Falling back to environment configuration for n8n API client');
    const config = (0, n8n_api_1.getN8nApiConfig)();
    if (!config) {
        if (defaultApiClient) {
            logger_1.logger.info('n8n API configuration removed, clearing default client');
            defaultApiClient = null;
            lastDefaultConfigUrl = null;
        }
        return null;
    }
    if (!defaultApiClient || lastDefaultConfigUrl !== config.baseUrl) {
        logger_1.logger.info('n8n API client initialized from environment', { url: config.baseUrl });
        defaultApiClient = new n8n_api_client_1.N8nApiClient(config);
        lastDefaultConfigUrl = config.baseUrl;
    }
    return defaultApiClient;
}
function ensureApiConfigured(context) {
    const client = getN8nApiClient(context);
    if (!client) {
        if (context?.instanceId) {
            throw new Error(`n8n API not configured for instance ${context.instanceId}. Please provide n8nApiUrl and n8nApiKey in the instance context.`);
        }
        throw new Error('n8n API not configured. Please set N8N_API_URL and N8N_API_KEY environment variables.');
    }
    return client;
}
function resolveN8nApiConfigForResponse(context) {
    const fromContext = context ? (0, n8n_api_1.getN8nApiConfigFromContext)(context) : null;
    if (fromContext) {
        return fromContext;
    }
    if (process.env.ENABLE_MULTI_TENANT === 'true') {
        return null;
    }
    return (0, n8n_api_1.getN8nApiConfig)();
}
function tryParseJson(val) {
    if (typeof val !== 'string')
        return val;
    try {
        return JSON.parse(val);
    }
    catch {
        return val;
    }
}
function stripActiveVersion(workflow) {
    const { activeVersion, ...rest } = workflow;
    return rest;
}
const emptyToUndefined = (v) => typeof v === 'string' && v.trim() === '' ? undefined : v;
const optionalEmptyAware = (schema) => zod_1.z.preprocess(emptyToUndefined, schema.optional());
const createWorkflowSchema = zod_1.z.object({
    name: zod_1.z.string(),
    nodes: zod_1.z.preprocess(mcp_input_normalizer_1.normalizeMcpWorkflowNodes, zod_1.z.array(zod_1.z.any())),
    connections: zod_1.z.preprocess(mcp_input_normalizer_1.normalizeMcpWorkflowConnections, zod_1.z.record(zod_1.z.string(), zod_1.z.any())),
    settings: zod_1.z.preprocess(mcp_input_normalizer_1.normalizeMcpJsonValue, zod_1.z.object({
        executionOrder: zod_1.z.enum(['v0', 'v1']).optional(),
        timezone: zod_1.z.string().optional(),
        saveDataErrorExecution: zod_1.z.enum(['all', 'none']).optional(),
        saveDataSuccessExecution: zod_1.z.enum(['all', 'none']).optional(),
        saveManualExecutions: zod_1.z.boolean().optional(),
        saveExecutionProgress: zod_1.z.boolean().optional(),
        executionTimeout: zod_1.z.number().optional(),
        errorWorkflow: zod_1.z.string().optional(),
    }).passthrough()).optional(),
    nodeGroups: zod_1.z.any().optional(),
    projectId: zod_1.z.string().optional(),
    parentFolderId: optionalEmptyAware(zod_1.z.string().trim().min(1)),
});
const updateWorkflowSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string().optional(),
    nodes: zod_1.z.preprocess(mcp_input_normalizer_1.normalizeMcpWorkflowNodes, zod_1.z.array(zod_1.z.any())).optional(),
    connections: zod_1.z.preprocess(mcp_input_normalizer_1.normalizeMcpWorkflowConnections, zod_1.z.record(zod_1.z.string(), zod_1.z.any())).optional(),
    settings: zod_1.z.preprocess(mcp_input_normalizer_1.normalizeMcpJsonValue, zod_1.z.any()).optional(),
    nodeGroups: zod_1.z.any().optional(),
    parentFolderId: optionalEmptyAware(zod_1.z.string().trim().min(1).nullable()),
    createBackup: zod_1.z.boolean().optional(),
    intent: zod_1.z.string().optional(),
});
const listWorkflowsSchema = zod_1.z.object({
    limit: zod_1.z.number().min(1).max(100).optional(),
    cursor: optionalEmptyAware(zod_1.z.string()),
    active: zod_1.z.boolean().optional(),
    tags: zod_1.z.preprocess(mcp_input_normalizer_1.normalizeMcpJsonValue, zod_1.z.array(zod_1.z.string())).optional(),
    projectId: optionalEmptyAware(zod_1.z.string()),
    excludePinnedData: zod_1.z.boolean().optional(),
});
const validateWorkflowSchema = zod_1.z.object({
    id: zod_1.z.string(),
    options: zod_1.z.object({
        validateNodes: zod_1.z.boolean().optional(),
        validateConnections: zod_1.z.boolean().optional(),
        validateExpressions: zod_1.z.boolean().optional(),
        profile: zod_1.z.enum(['minimal', 'runtime', 'ai-friendly', 'strict']).optional(),
    }).optional(),
});
const autofixWorkflowSchema = zod_1.z.object({
    id: zod_1.z.string(),
    applyFixes: zod_1.z.boolean().optional().default(false),
    fixTypes: zod_1.z.array(zod_1.z.enum([
        'expression-format',
        'typeversion-correction',
        'error-output-config',
        'node-type-correction',
        'webhook-missing-path',
        'typeversion-upgrade',
        'version-migration',
        'tool-variant-correction',
        'connection-numeric-keys',
        'connection-invalid-type',
        'connection-id-to-name',
        'connection-duplicate-removal',
        'connection-input-index'
    ])).optional(),
    confidenceThreshold: zod_1.z.enum(['high', 'medium', 'low']).optional().default('medium'),
    maxFixes: zod_1.z.number().optional().default(50)
});
const testWorkflowSchema = zod_1.z.object({
    workflowId: zod_1.z.string(),
    method: optionalEmptyAware(zod_1.z.enum(['auto', 'trigger', 'prepare', 'pinned', 'direct'])),
    triggerType: optionalEmptyAware(zod_1.z.enum(['webhook', 'form', 'chat'])),
    httpMethod: optionalEmptyAware(zod_1.z.enum(['GET', 'POST', 'PUT', 'DELETE'])),
    webhookPath: optionalEmptyAware(zod_1.z.string()),
    message: optionalEmptyAware(zod_1.z.string()),
    sessionId: optionalEmptyAware(zod_1.z.string()),
    data: zod_1.z.record(zod_1.z.unknown()).optional(),
    headers: zod_1.z.record(zod_1.z.string()).optional(),
    timeout: zod_1.z.number().optional(),
    waitForResponse: zod_1.z.boolean().optional(),
    exposeToMcp: zod_1.z.boolean().optional(),
    timeoutMs: zod_1.z.number().int().min(agents_action_map_1.MIN_TIMEOUT_MS).max(agents_action_map_1.MAX_TIMEOUT_MS).optional(),
    pinData: zod_1.z.record(zod_1.z.array(zod_1.z.unknown())).optional(),
    triggerNodeName: optionalEmptyAware(zod_1.z.string()),
    executionMode: optionalEmptyAware(zod_1.z.enum(['manual', 'production'])),
});
const listExecutionsSchema = zod_1.z.object({
    limit: zod_1.z.number().min(1).max(100).optional(),
    cursor: optionalEmptyAware(zod_1.z.string()),
    workflowId: optionalEmptyAware(zod_1.z.string()),
    projectId: optionalEmptyAware(zod_1.z.string()),
    status: optionalEmptyAware(zod_1.z.enum(['success', 'error', 'waiting'])),
    includeData: zod_1.z.boolean().optional(),
});
const testRunPathId = zod_1.z.string().trim().min(1);
const listTestRunsSchema = zod_1.z.object({
    workflowId: testRunPathId,
    status: optionalEmptyAware(zod_1.z.enum(['new', 'running', 'completed', 'error', 'cancelled'])),
    limit: zod_1.z.number().min(1).max(250).optional(),
    cursor: optionalEmptyAware(zod_1.z.string()),
});
const getTestRunSchema = zod_1.z.object({
    workflowId: testRunPathId,
    runId: testRunPathId,
});
const listTestCasesSchema = zod_1.z.object({
    workflowId: testRunPathId,
    runId: testRunPathId,
    limit: zod_1.z.number().min(1).max(250).optional(),
    cursor: optionalEmptyAware(zod_1.z.string()),
});
const triggerTestRunSchema = zod_1.z.object({
    workflowId: testRunPathId,
});
const cancelTestRunSchema = zod_1.z.object({
    workflowId: testRunPathId,
    runId: testRunPathId,
});
const versionIdValue = zod_1.z.union([zod_1.z.number().int(), zod_1.z.string().min(1)]);
const workflowVersionsSchema = zod_1.z.object({
    mode: zod_1.z.preprocess(emptyToUndefined, zod_1.z.enum(['list', 'get', 'rollback', 'delete', 'prune', 'diff']).default('list')),
    source: zod_1.z.enum(['local', 'native']).optional(),
    workflowId: zod_1.z.string().optional(),
    versionId: versionIdValue.optional(),
    toVersionId: versionIdValue.optional(),
    limit: zod_1.z.number().default(10).optional(),
    offset: zod_1.z.number().int().min(0).optional(),
    validateBefore: zod_1.z.boolean().default(true).optional(),
    deleteAll: zod_1.z.boolean().default(false).optional(),
    maxVersions: zod_1.z.number().default(10).optional(),
    exposeToMcp: zod_1.z.boolean().optional(),
    timeoutMs: zod_1.z.number().int().min(5000).max(600000).optional(),
});
async function handleCreateWorkflow(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = createWorkflowSchema.parse(args);
        const shortFormErrors = [];
        input.nodes?.forEach((node, index) => {
            if (node.type?.startsWith('nodes-base.') || node.type?.startsWith('nodes-langchain.')) {
                const fullForm = node.type.startsWith('nodes-base.')
                    ? node.type.replace('nodes-base.', 'n8n-nodes-base.')
                    : node.type.replace('nodes-langchain.', '@n8n/n8n-nodes-langchain.');
                shortFormErrors.push(`Node ${index} ("${node.name}") uses SHORT form "${node.type}". ` +
                    `The n8n API requires FULL form. Change to "${fullForm}"`);
            }
        });
        if (shortFormErrors.length > 0) {
            telemetry_1.telemetry.trackWorkflowCreation(input, false);
            return {
                success: false,
                error: 'Node type format error: n8n API requires FULL form node types',
                details: {
                    errors: shortFormErrors,
                    hint: 'Use n8n-nodes-base.* instead of nodes-base.* for standard nodes'
                }
            };
        }
        const errors = (0, n8n_validation_1.validateWorkflowStructure)(input);
        if (errors.length > 0) {
            telemetry_1.telemetry.trackWorkflowCreation(input, false);
            return {
                success: false,
                error: 'Workflow validation failed',
                details: { errors }
            };
        }
        const { nodeGroups: rawNodeGroups, ...createPayload } = input;
        const nodeGroups = (0, node_groups_1.parseNodeGroupsInput)(rawNodeGroups);
        const groupWarnings = [];
        const workflow = await client.createWorkflow(nodeGroups !== undefined ? { ...createPayload, nodeGroups } : createPayload, {
            authoredGroups: new Set((nodeGroups ?? []).map(group => group.name)),
            onWarning: message => groupWarnings.push(message),
        });
        if (!workflow || !workflow.id) {
            return {
                success: false,
                error: 'Workflow creation failed: n8n API returned an empty or invalid response. Verify your N8N_API_URL points to the correct /api/v1 endpoint and that the n8n instance supports workflow creation.',
                details: {
                    response: workflow ? { keys: Object.keys(workflow) } : null
                }
            };
        }
        telemetry_1.telemetry.trackWorkflowCreation(workflow, true);
        return {
            success: true,
            data: {
                id: workflow.id,
                name: workflow.name,
                active: workflow.active,
                nodeCount: workflow.nodes?.length || 0
            },
            message: `Workflow "${workflow.name}" created successfully with ID: ${workflow.id}. Use n8n_get_workflow with mode 'structure' to verify current state.`,
            ...(groupWarnings.length > 0 ? { details: { warnings: groupWarnings } } : {})
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code,
                details: error.details
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
async function handleGetWorkflow(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { id } = zod_1.z.object({ id: zod_1.z.string() }).parse(args);
        const workflow = await client.getWorkflow(id);
        return {
            success: true,
            data: stripActiveVersion(workflow)
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
async function handleGetWorkflowDetails(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { id } = zod_1.z.object({ id: zod_1.z.string() }).parse(args);
        const workflow = await client.getWorkflow(id);
        const executions = await client.listExecutions({
            workflowId: id,
            limit: 10
        });
        const stats = {
            totalExecutions: executions.data.length,
            successCount: executions.data.filter(e => e.status === n8n_api_2.ExecutionStatus.SUCCESS).length,
            errorCount: executions.data.filter(e => e.status === n8n_api_2.ExecutionStatus.ERROR).length,
            lastExecutionTime: executions.data[0]?.startedAt || null
        };
        return {
            success: true,
            data: {
                workflow: stripActiveVersion(workflow),
                executionStats: stats,
                hasWebhookTrigger: (0, n8n_validation_1.hasWebhookTrigger)(workflow),
                webhookPath: (0, n8n_validation_1.getWebhookUrl)(workflow)
            }
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
async function handleGetWorkflowStructure(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { id } = zod_1.z.object({ id: zod_1.z.string() }).parse(args);
        const workflow = await client.getWorkflow(id);
        const simplifiedNodes = workflow.nodes.map(node => ({
            id: node.id,
            name: node.name,
            type: node.type,
            position: node.position,
            disabled: node.disabled || false
        }));
        return {
            success: true,
            data: {
                id: workflow.id,
                name: workflow.name,
                active: workflow.active,
                isArchived: workflow.isArchived,
                nodes: simplifiedNodes,
                connections: workflow.connections,
                ...(0, node_groups_1.nodeGroupsField)(workflow.nodeGroups),
                nodeCount: workflow.nodes.length,
                connectionCount: Object.keys(workflow.connections).length
            }
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
async function handleGetWorkflowMinimal(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { id } = zod_1.z.object({ id: zod_1.z.string() }).parse(args);
        const workflow = await client.getWorkflow(id);
        return {
            success: true,
            data: {
                id: workflow.id,
                name: workflow.name,
                active: workflow.active,
                isArchived: workflow.isArchived,
                tags: workflow.tags || [],
                createdAt: workflow.createdAt,
                updatedAt: workflow.updatedAt
            }
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
async function handleGetWorkflowFiltered(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { id, nodeNames } = zod_1.z.object({
            id: zod_1.z.string(),
            nodeNames: zod_1.z.array(zod_1.z.string()).min(1)
        }).parse(args);
        const workflow = await client.getWorkflow(id);
        const requested = new Set(nodeNames);
        const matchedNodes = workflow.nodes.filter(node => requested.has(node.name) || requested.has(node.id));
        const matchedKeys = new Set(matchedNodes.flatMap(node => [node.name, node.id]));
        const notFound = nodeNames.filter(key => !matchedKeys.has(key));
        const matchedIds = new Set(matchedNodes.map(node => node.id));
        const touchedGroups = (workflow.nodeGroups ?? []).filter(group => Array.isArray(group?.nodeIds) && group.nodeIds.some(nodeId => matchedIds.has(nodeId)));
        return {
            success: true,
            data: {
                id: workflow.id,
                name: workflow.name,
                active: workflow.active,
                isArchived: workflow.isArchived,
                nodes: matchedNodes,
                ...(0, node_groups_1.nodeGroupsField)(touchedGroups),
                nodeCount: workflow.nodes.length,
                returnedCount: matchedNodes.length,
                ...(notFound.length > 0 ? { notFound } : {})
            }
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
async function handleGetWorkflowActive(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { id } = zod_1.z.object({ id: zod_1.z.string() }).parse(args);
        const workflow = await client.getWorkflow(id);
        const activeVersion = workflow.activeVersion;
        const baseMeta = {
            id: workflow.id,
            name: workflow.name,
            active: workflow.active,
            isArchived: workflow.isArchived,
            tags: workflow.tags || [],
            settings: workflow.settings,
            createdAt: workflow.createdAt,
            updatedAt: workflow.updatedAt,
        };
        if (workflow.activeVersionId && activeVersion) {
            return {
                success: true,
                data: {
                    ...baseMeta,
                    activeVersionId: workflow.activeVersionId,
                    versionCreatedAt: activeVersion.createdAt ?? null,
                    versionName: activeVersion.name ?? null,
                    nodes: activeVersion.nodes,
                    connections: activeVersion.connections,
                    ...(0, node_groups_1.nodeGroupsField)(activeVersion.nodeGroups),
                }
            };
        }
        if (workflow.active === true) {
            return {
                success: true,
                data: {
                    ...baseMeta,
                    activeVersionId: null,
                    versionCreatedAt: null,
                    versionName: null,
                    nodes: workflow.nodes,
                    connections: workflow.connections,
                    ...(0, node_groups_1.nodeGroupsField)(workflow.nodeGroups),
                }
            };
        }
        return {
            success: false,
            error: 'No published version. Workflow is inactive and has never been activated. Use mode="full" to see the draft.',
            code: 'NO_ACTIVE_VERSION'
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
async function handleUpdateWorkflow(args, repository, context) {
    const startTime = Date.now();
    const sessionId = `mutation_${Date.now()}_${(0, crypto_1.randomUUID)()}`;
    let workflowBefore = null;
    let userIntent = 'Full workflow update';
    let sentParentFolderId = false;
    try {
        const client = ensureApiConfigured(context);
        const input = updateWorkflowSchema.parse(args);
        const { id, createBackup, intent, ...updateData } = input;
        userIntent = intent || 'Full workflow update';
        sentParentFolderId = updateData.parentFolderId !== undefined;
        const current = await client.getWorkflow(id);
        workflowBefore = JSON.parse(JSON.stringify(current));
        if (updateData.nodes && current.nodes) {
            const currentById = new Map();
            const currentByName = new Map();
            for (const node of current.nodes) {
                if (node.id)
                    currentById.set(node.id, node);
                currentByName.set(node.name, node);
            }
            for (const node of updateData.nodes) {
                const hasCredentials = node.credentials && typeof node.credentials === 'object' && Object.keys(node.credentials).length > 0;
                if (!hasCredentials) {
                    const match = (node.id && currentById.get(node.id)) || currentByName.get(node.name);
                    if (match?.credentials) {
                        node.credentials = match.credentials;
                    }
                }
            }
        }
        const { settings: settingsUpdate, nodeGroups: rawNodeGroups, ...nonSettingsUpdate } = updateData;
        const nodeGroupsUpdate = (0, node_groups_1.parseNodeGroupsInput)(rawNodeGroups);
        const fullWorkflow = {
            ...current,
            ...nonSettingsUpdate
        };
        if (settingsUpdate && typeof settingsUpdate === 'object') {
            fullWorkflow.settings = {
                ...(current.settings ?? {}),
                ...settingsUpdate,
            };
        }
        if (nodeGroupsUpdate !== undefined) {
            fullWorkflow.nodeGroups = nodeGroupsUpdate;
        }
        if (updateData.nodes || updateData.connections || nodeGroupsUpdate !== undefined) {
            if (createBackup !== false) {
                try {
                    const versioningService = new workflow_versioning_service_1.WorkflowVersioningService(repository, client, (0, instance_context_1.getInstanceScopeId)(context));
                    const backupResult = await versioningService.createBackup(id, current, {
                        trigger: 'full_update'
                    });
                    logger_1.logger.info('Workflow backup created', {
                        workflowId: id,
                        versionId: backupResult.versionId,
                        versionNumber: backupResult.versionNumber,
                        pruned: backupResult.pruned
                    });
                }
                catch (error) {
                    logger_1.logger.warn('Failed to create workflow backup', {
                        workflowId: id,
                        error: error.message
                    });
                }
            }
            const errors = (0, n8n_validation_1.validateWorkflowStructure)(fullWorkflow);
            if (errors.length > 0) {
                return {
                    success: false,
                    error: 'Workflow validation failed',
                    details: { errors }
                };
            }
        }
        const groupWarnings = [];
        const workflow = await client.updateWorkflow(id, fullWorkflow, {
            authoredGroups: new Set((nodeGroupsUpdate ?? []).map(group => group.name)),
            onWarning: message => groupWarnings.push(message),
        });
        if (workflowBefore) {
            void trackWorkflowMutationForFullUpdate({
                sessionId,
                toolName: 'n8n_update_full_workflow',
                userIntent,
                operations: [],
                workflowBefore,
                workflowAfter: workflow,
                mutationSuccess: true,
                durationMs: Date.now() - startTime,
            }).catch(err => {
                logger_1.logger.warn('Failed to track mutation telemetry:', err);
            });
        }
        return {
            success: true,
            data: {
                id: workflow.id,
                name: workflow.name,
                active: workflow.active,
                nodeCount: workflow.nodes?.length || 0
            },
            message: `Workflow "${workflow.name}" updated successfully. Use n8n_get_workflow with mode 'structure' to verify current state.`,
            ...(groupWarnings.length > 0 ? { details: { warnings: groupWarnings } } : {})
        };
    }
    catch (error) {
        if (workflowBefore) {
            void trackWorkflowMutationForFullUpdate({
                sessionId,
                toolName: 'n8n_update_full_workflow',
                userIntent,
                operations: [],
                workflowBefore,
                workflowAfter: workflowBefore,
                mutationSuccess: false,
                mutationError: error instanceof Error ? error.message : 'Unknown error',
                durationMs: Date.now() - startTime,
            }).catch(err => {
                logger_1.logger.warn('Failed to track mutation telemetry for failed operation:', err);
            });
        }
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            const baseDetails = error.details;
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error) + (sentParentFolderId
                    ? ' A folder move in the failed update may still have persisted - n8n cannot report or restore folder placement.'
                    : ''),
                code: error.code,
                details: sentParentFolderId
                    ? { ...(baseDetails ?? {}), folderMoveMayHavePersisted: true }
                    : baseDetails
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
async function trackWorkflowMutationForFullUpdate(data) {
    try {
        const { telemetry } = await Promise.resolve().then(() => __importStar(require('../telemetry/telemetry-manager.js')));
        await telemetry.trackWorkflowMutation(data);
    }
    catch (error) {
        logger_1.logger.debug('Telemetry tracking failed:', error);
    }
}
async function handleDeleteWorkflow(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { id } = zod_1.z.object({ id: zod_1.z.string() }).parse(args);
        const deleted = await client.deleteWorkflow(id);
        return {
            success: true,
            data: {
                id: deleted?.id || id,
                name: deleted?.name,
                deleted: true
            },
            message: `Workflow "${deleted?.name || id}" deleted successfully.`
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
async function handleActivateWorkflow(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { id, active } = zod_1.z.object({ id: zod_1.z.string(), active: zod_1.z.boolean() }).parse(args);
        const workflow = active
            ? await client.activateWorkflow(id)
            : await client.deactivateWorkflow(id);
        return {
            success: true,
            data: {
                id: workflow.id,
                name: workflow.name,
                active: workflow.active,
            },
            message: `Workflow "${workflow.name || id}" ${active ? 'activated' : 'deactivated'} successfully.`
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
async function handleListWorkflows(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = listWorkflowsSchema.parse(args || {});
        const tagsParam = input.tags && input.tags.length > 0
            ? input.tags.join(',')
            : undefined;
        const response = await client.listWorkflows({
            limit: input.limit || 100,
            cursor: input.cursor,
            active: input.active,
            tags: tagsParam,
            projectId: input.projectId,
            excludePinnedData: input.excludePinnedData ?? true
        });
        const minimalWorkflows = response.data.map(workflow => ({
            id: workflow.id,
            name: workflow.name,
            active: workflow.active,
            isArchived: workflow.isArchived,
            createdAt: workflow.createdAt,
            updatedAt: workflow.updatedAt,
            tags: workflow.tags || [],
            nodeCount: workflow.nodes?.length || 0
        }));
        return {
            success: true,
            data: {
                workflows: minimalWorkflows,
                returned: minimalWorkflows.length,
                nextCursor: response.nextCursor,
                hasMore: !!response.nextCursor,
                ...(response.nextCursor ? {
                    _note: "More workflows available. Use cursor to get next page."
                } : {})
            }
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
async function handleValidateWorkflow(args, repository, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = validateWorkflowSchema.parse(args);
        const workflowResponse = await handleGetWorkflow({ id: input.id }, context);
        if (!workflowResponse.success) {
            return workflowResponse;
        }
        const workflow = workflowResponse.data;
        const validator = new workflow_validator_1.WorkflowValidator(repository, enhanced_config_validator_1.EnhancedConfigValidator);
        const validationResult = await validator.validateWorkflow(workflow, input.options);
        const response = {
            valid: validationResult.valid,
            workflowId: workflow.id,
            workflowName: workflow.name,
            summary: {
                totalNodes: validationResult.statistics.totalNodes,
                enabledNodes: validationResult.statistics.enabledNodes,
                triggerNodes: validationResult.statistics.triggerNodes,
                validConnections: validationResult.statistics.validConnections,
                invalidConnections: validationResult.statistics.invalidConnections,
                expressionsValidated: validationResult.statistics.expressionsValidated,
                errorCount: validationResult.errors.length,
                warningCount: validationResult.warnings.length
            }
        };
        if (validationResult.errors.length > 0) {
            response.errors = validationResult.errors.map(e => ({
                node: e.nodeName || 'workflow',
                nodeName: e.nodeName,
                message: e.message,
                details: e.details
            }));
        }
        if (validationResult.warnings.length > 0) {
            response.warnings = validationResult.warnings.map(w => ({
                node: w.nodeName || 'workflow',
                nodeName: w.nodeName,
                message: w.message,
                details: w.details
            }));
        }
        if (validationResult.suggestions.length > 0) {
            response.suggestions = validationResult.suggestions;
        }
        if (validationResult.valid) {
            telemetry_1.telemetry.trackWorkflowCreation(workflow, true);
        }
        return {
            success: true,
            data: response
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
async function handleAutofixWorkflow(args, repository, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = autofixWorkflowSchema.parse(args);
        const workflowResponse = await handleGetWorkflow({ id: input.id }, context);
        if (!workflowResponse.success) {
            return workflowResponse;
        }
        const workflow = workflowResponse.data;
        const validator = new workflow_validator_1.WorkflowValidator(repository, enhanced_config_validator_1.EnhancedConfigValidator);
        const validationResult = await validator.validateWorkflow(workflow, {
            validateNodes: true,
            validateConnections: true,
            validateExpressions: true,
            profile: 'ai-friendly'
        });
        const allFormatIssues = [];
        for (const node of workflow.nodes) {
            const formatContext = {
                nodeType: node.type,
                nodeName: node.name,
                nodeId: node.id
            };
            const nodeFormatIssues = expression_format_validator_1.ExpressionFormatValidator.validateNodeParameters(node.parameters, formatContext);
            const enrichedIssues = nodeFormatIssues.map(issue => ({
                ...issue,
                nodeName: node.name,
                nodeId: node.id
            }));
            allFormatIssues.push(...enrichedIssues);
        }
        const autoFixer = new workflow_auto_fixer_1.WorkflowAutoFixer(repository);
        const fixResult = await autoFixer.generateFixes(workflow, validationResult, allFormatIssues, {
            applyFixes: input.applyFixes,
            fixTypes: input.fixTypes,
            confidenceThreshold: input.confidenceThreshold,
            maxFixes: input.maxFixes
        });
        if (fixResult.fixes.length === 0) {
            return {
                success: true,
                data: {
                    workflowId: workflow.id,
                    workflowName: workflow.name,
                    message: 'No automatic fixes available for this workflow',
                    validationSummary: {
                        errors: validationResult.errors.length,
                        warnings: validationResult.warnings.length
                    }
                }
            };
        }
        if (!input.applyFixes) {
            return {
                success: true,
                data: {
                    workflowId: workflow.id,
                    workflowName: workflow.name,
                    preview: true,
                    fixesAvailable: fixResult.fixes.length,
                    fixes: fixResult.fixes,
                    summary: fixResult.summary,
                    stats: fixResult.stats,
                    message: `${fixResult.fixes.length} fixes available. Set applyFixes=true to apply them.`
                }
            };
        }
        if (fixResult.operations.length > 0) {
            const updateResult = await (0, handlers_workflow_diff_1.handleUpdatePartialWorkflow)({
                id: workflow.id,
                operations: fixResult.operations,
                createBackup: true
            }, repository, context);
            if (!updateResult.success) {
                return {
                    success: false,
                    error: 'Failed to apply fixes',
                    details: {
                        fixes: fixResult.fixes,
                        updateError: updateResult.error
                    }
                };
            }
            return {
                success: true,
                data: {
                    workflowId: workflow.id,
                    workflowName: workflow.name,
                    fixesApplied: fixResult.fixes.length,
                    fixes: fixResult.fixes,
                    summary: fixResult.summary,
                    stats: fixResult.stats,
                    message: `Successfully applied ${fixResult.fixes.length} fixes to workflow "${workflow.name}"`
                }
            };
        }
        return {
            success: true,
            data: {
                workflowId: workflow.id,
                workflowName: workflow.name,
                message: 'No fixes needed'
            }
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
const OFFICIAL_TEST_ACTION = 'test_workflow';
const FAILED_RUN_STATUSES = new Set(['error', 'crashed', 'canceled']);
const LEGACY_TIMEOUT_SCOPE_WARNING = 'timeout applies to the HTTP trigger path only; use timeoutMs for method prepare/pinned/direct';
const OFFICIAL_TEST_METHODS = new Set(['prepare', 'pinned', 'direct']);
async function handleTestWorkflow(args, context) {
    try {
        const input = testWorkflowSchema.parse(args);
        const method = input.method ?? 'auto';
        const apiClient = getN8nApiClient(context);
        const officialTimeoutMs = input.timeoutMs ?? (method === 'prepare' ? agents_action_map_1.DEFAULT_TIMEOUT_MS : agents_action_map_1.PINNED_TIMEOUT_MS);
        const routeOfficial = async (aliases, officialArgs, idempotent, resolvedMethod) => {
            const response = await (0, mcp_exposure_1.withMcpExposure)({
                apiClient,
                workflowId: input.workflowId,
                exposeToMcp: input.exposeToMcp,
                action: OFFICIAL_TEST_ACTION,
                toolName: 'n8n_test_workflow',
                context,
            }, () => (0, handlers_official_tools_1.callOfficialTool)(context, aliases, officialArgs, officialTimeoutMs, OFFICIAL_TEST_ACTION, idempotent));
            const decorated = { ...response, method: resolvedMethod, backend: 'official-mcp' };
            if (input.timeout !== undefined && decorated.success) {
                decorated.warnings = [...(decorated.warnings ?? []), LEGACY_TIMEOUT_SCOPE_WARNING];
            }
            return decorated;
        };
        if (method === 'pinned' && Object.keys(input.pinData ?? {}).length === 0) {
            return {
                success: false,
                code: 'INVALID_ARGS',
                method: 'pinned',
                error: 'pinData is required for method: pinned (keys are node names, values are arrays of items wrapped as { "json": { ... } }). Run method: prepare first to see which nodes need pinned data.',
            };
        }
        if ((method === 'auto' || method === 'trigger') && (0, tool_policy_1.isOperationDisabled)('n8n_test_workflow', 'trigger')) {
            return {
                success: false,
                code: 'OPERATION_DISABLED',
                method: 'trigger',
                backend: 'public-api',
                error: "Operation 'trigger' on tool 'n8n_test_workflow' is disabled by server policy.",
                details: { requestedMethod: method },
            };
        }
        const isPlainPrepare = method === 'prepare' && input.exposeToMcp !== true;
        if (!isPlainPrepare && !(0, mcp_exposure_1.publicApiMatchesContext)(context)) {
            return {
                success: false,
                code: 'NOT_CONFIGURED',
                method,
                backend: OFFICIAL_TEST_METHODS.has(method) ? 'official-mcp' : 'public-api',
                error: mcp_exposure_1.PUBLIC_API_CONTEXT_HINT,
            };
        }
        if (method === 'prepare') {
            return routeOfficial(['prepare_workflow_pin_data'], { workflowId: input.workflowId }, true, 'prepare');
        }
        const client = ensureApiConfigured(context);
        const { detectTriggerFromWorkflow, classifyTriggerNode, ensureRegistryInitialized, TriggerRegistry, } = await Promise.resolve().then(() => __importStar(require('../triggers')));
        const workflow = await client.getWorkflow(input.workflowId);
        const detection = detectTriggerFromWorkflow(workflow);
        const detectedNodeName = detection.trigger?.node.name;
        if (method === 'pinned') {
            const pinnedTriggerNode = input.triggerNodeName ?? detectedNodeName;
            const response = await routeOfficial(['test_workflow'], {
                workflowId: input.workflowId,
                pinData: input.pinData,
                ...(pinnedTriggerNode ? { triggerNodeName: pinnedTriggerNode } : {}),
                timeout: Math.max(1, Math.floor(officialTimeoutMs / 1000) - 5),
            }, false, 'pinned');
            if (!response.success)
                return response;
            const run = (response.data ?? {});
            const executionId = typeof run.executionId === 'string' ? run.executionId : undefined;
            const status = typeof run.status === 'string' ? run.status : undefined;
            if (status && FAILED_RUN_STATUSES.has(status)) {
                return {
                    ...response,
                    success: false,
                    code: 'EXECUTION_FAILED',
                    error: typeof run.error === 'string' ? run.error : `Run finished with status ${status}`,
                    ...(executionId ? { executionId } : {}),
                };
            }
            return { ...response, ...(executionId ? { executionId } : {}) };
        }
        if (method === 'direct') {
            const namedNode = input.triggerNodeName
                ? (workflow.nodes ?? []).find(node => node.name === input.triggerNodeName)
                : undefined;
            if (input.triggerNodeName && !namedNode) {
                return {
                    success: false,
                    code: 'INVALID_ARGS',
                    method: 'direct',
                    backend: 'official-mcp',
                    error: `triggerNodeName "${input.triggerNodeName}" is not a node of workflow ${input.workflowId}`,
                };
            }
            const triggerKind = input.triggerNodeName
                ? (namedNode ? classifyTriggerNode(namedNode) : null)
                : (detection.trigger?.type ?? null);
            let inputs;
            if (input.message !== undefined) {
                inputs = { chatInput: input.message };
            }
            else if (input.data && triggerKind === 'form') {
                inputs = { formData: input.data };
            }
            else if (input.data || input.headers || input.httpMethod) {
                inputs = {
                    webhookData: {
                        method: input.httpMethod ?? 'POST',
                        ...(input.data ? { body: input.data } : {}),
                        ...(input.headers ? { headers: input.headers } : {}),
                    },
                };
            }
            const directTriggerNode = input.triggerNodeName ?? (inputs ? detectedNodeName : undefined);
            if (inputs && !directTriggerNode) {
                return {
                    success: false,
                    code: 'INVALID_ARGS',
                    method: 'direct',
                    error: 'triggerNodeName is required when inputs are given and no trigger node could be detected',
                    details: { workflowId: input.workflowId, reason: detection.reason },
                };
            }
            const response = await routeOfficial(['execute_workflow'], {
                workflowId: input.workflowId,
                executionMode: input.executionMode ?? 'manual',
                ...(directTriggerNode ? { triggerNodeName: directTriggerNode } : {}),
                ...(inputs ? { inputs } : {}),
            }, false, 'direct');
            if (!response.success)
                return response;
            const executionId = response.data?.executionId;
            return {
                ...response,
                ...(typeof executionId === 'string' ? { executionId } : {}),
                hint: 'execute_workflow returns as soon as the run starts; poll n8n_executions with the executionId for the result.',
            };
        }
        await ensureRegistryInitialized();
        let triggerType = input.triggerType;
        let triggerInfo;
        if (!triggerType) {
            if (detection.detected && detection.trigger) {
                triggerType = detection.trigger.type;
                triggerInfo = detection.trigger;
            }
            else {
                return {
                    success: false,
                    error: 'Workflow cannot be triggered externally',
                    method,
                    backend: 'public-api',
                    details: {
                        workflowId: input.workflowId,
                        reason: detection.reason,
                        hint: 'Only workflows with webhook, form, or chat triggers can be executed via the API. Add one of these trigger nodes to your workflow.'
                            + ' To run it anyway through n8n\'s MCP server, call again with method: direct (executionMode manual) or method: pinned with pinData from method: prepare — both need N8N_MCP_ACCESS_TOKEN.',
                    },
                };
            }
        }
        else {
            if (detection.detected && detection.trigger?.type === triggerType) {
                triggerInfo = detection.trigger;
            }
            else if (!detection.detected || detection.trigger?.type !== triggerType) {
                return {
                    success: false,
                    error: `Workflow does not have a ${triggerType} trigger`,
                    method: 'trigger',
                    backend: 'public-api',
                    details: {
                        workflowId: input.workflowId,
                        requestedTrigger: triggerType,
                        detectedTrigger: detection.trigger?.type || 'none',
                        hint: detection.detected
                            ? `Workflow has a ${detection.trigger?.type} trigger. Either use that type or omit triggerType for auto-detection.`
                            : 'Workflow has no externally-triggerable triggers (webhook, form, or chat).',
                    },
                };
            }
        }
        const handler = TriggerRegistry.getHandler(triggerType, client, context);
        if (!handler) {
            return {
                success: false,
                error: `No handler registered for trigger type: ${triggerType}`,
                method: 'trigger',
                backend: 'public-api',
                details: {
                    supportedTypes: TriggerRegistry.getRegisteredTypes(),
                },
            };
        }
        if (handler.capabilities.requiresActiveWorkflow && !workflow.active) {
            return {
                success: false,
                error: 'Workflow must be active to trigger via this method',
                method: 'trigger',
                backend: 'public-api',
                details: {
                    workflowId: input.workflowId,
                    triggerType,
                    hint: 'Activate the workflow in n8n using n8n_update_partial_workflow with [{type: "activateWorkflow"}]',
                },
            };
        }
        if (triggerType === 'chat' && !input.message) {
            return {
                success: false,
                error: 'Chat trigger requires a message parameter',
                method: 'trigger',
                backend: 'public-api',
                details: {
                    hint: 'Provide message="your message" for chat triggers',
                },
            };
        }
        const triggerInput = {
            workflowId: input.workflowId,
            triggerType,
            httpMethod: input.httpMethod,
            webhookPath: input.webhookPath,
            message: input.message || '',
            sessionId: input.sessionId,
            data: input.data,
            formData: input.data,
            headers: input.headers,
            timeout: input.timeout,
            waitForResponse: input.waitForResponse,
        };
        const response = await handler.execute(triggerInput, workflow, triggerInfo);
        return {
            success: response.success,
            data: response.data,
            message: response.success
                ? `Workflow triggered successfully via ${triggerType}`
                : response.error,
            executionId: response.executionId,
            workflowId: input.workflowId,
            method: 'trigger',
            backend: 'public-api',
            details: {
                triggerType,
                metadata: response.metadata,
                ...(response.details || {}),
            },
        };
    }
    catch (error) {
        const raw = (args && typeof args === 'object' ? args : {});
        const rawMethod = typeof raw.method === 'string' && raw.method.trim() !== '' ? raw.method : 'auto';
        const label = {
            method: rawMethod,
            backend: OFFICIAL_TEST_METHODS.has(rawMethod) ? 'official-mcp' : 'public-api',
        };
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                ...label,
                error: 'Invalid input',
                details: { errors: error.errors },
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                ...label,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code,
                details: error.details,
            };
        }
        return {
            success: false,
            ...label,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}
async function handleGetExecution(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const schema = zod_1.z.object({
            id: zod_1.z.string(),
            mode: zod_1.z.enum(['preview', 'summary', 'filtered', 'full', 'error']).optional(),
            nodeNames: zod_1.z.array(zod_1.z.string()).optional(),
            itemsLimit: zod_1.z.number().optional(),
            includeInputData: zod_1.z.boolean().optional(),
            includeData: zod_1.z.boolean().optional(),
            errorItemsLimit: zod_1.z.number().min(0).max(100).optional(),
            includeStackTrace: zod_1.z.boolean().optional(),
            includeExecutionPath: zod_1.z.boolean().optional(),
            fetchWorkflow: zod_1.z.boolean().optional()
        });
        const params = schema.parse(args);
        const { id, mode, nodeNames, itemsLimit, includeInputData, includeData, errorItemsLimit, includeStackTrace, includeExecutionPath, fetchWorkflow } = params;
        let effectiveMode = mode;
        if (!effectiveMode && includeData !== undefined) {
            effectiveMode = includeData ? 'summary' : undefined;
        }
        const fetchFullData = effectiveMode !== undefined || includeData === true;
        const execution = await client.getExecution(id, fetchFullData);
        if (!effectiveMode && !nodeNames && itemsLimit === undefined) {
            return {
                success: true,
                data: execution
            };
        }
        let workflow;
        if (effectiveMode === 'error' && fetchWorkflow !== false && execution.workflowId) {
            try {
                workflow = await client.getWorkflow(execution.workflowId);
            }
            catch (e) {
                logger_1.logger.debug('Could not fetch workflow for error analysis', {
                    workflowId: execution.workflowId,
                    error: e instanceof Error ? e.message : 'Unknown error'
                });
            }
        }
        const filterOptions = {
            mode: effectiveMode,
            nodeNames,
            itemsLimit,
            includeInputData,
            errorItemsLimit,
            includeStackTrace,
            includeExecutionPath
        };
        const processedExecution = (0, execution_processor_1.processExecution)(execution, filterOptions, workflow);
        return {
            success: true,
            data: processedExecution
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
async function handleListExecutions(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = listExecutionsSchema.parse(args || {});
        const response = await client.listExecutions({
            limit: input.limit || 100,
            cursor: input.cursor,
            workflowId: input.workflowId,
            projectId: input.projectId,
            status: input.status,
            includeData: input.includeData || false
        });
        return {
            success: true,
            data: {
                executions: response.data,
                returned: response.data.length,
                nextCursor: response.nextCursor,
                hasMore: !!response.nextCursor,
                ...(response.nextCursor ? {
                    _note: "More executions available. Use cursor to get next page."
                } : {})
            }
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
async function handleDeleteExecution(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { id } = zod_1.z.object({ id: zod_1.z.string() }).parse(args);
        await client.deleteExecution(id);
        return {
            success: true,
            message: `Execution ${id} deleted successfully`
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
const TEST_RUN_QUOTA_HINT = 'n8n rejected the request (402): the plan\'s evaluation quota is used up. It caps how many workflows may have test runs, and this workflow does not hold one of the slots. Re-run a workflow that already has runs, or raise the limit on your n8n plan.';
function testRunWriteScopeHint(scope) {
    return `n8n rejected the request (403). The API key lacks the ${scope} scope - that scope only exists on keys created on n8n 2.32+, so re-create the key there. Other causes: evaluations not licensed on this plan, or the key's owner lacks workflow:execute on this workflow.`;
}
const TEST_RUN_IDS_HINT = 'Workflow or test run not found. A runId must belong to the given workflowId; check both ids.';
const TEST_RUN_WORKFLOW_HINT = "Workflow not found. Check the workflowId, and that the API key's owner has access to that workflow.";
const READ_TEST_RUN_BASE = {
    minMinor: 30,
    capability: 'read test runs',
    scopeHint: 'n8n rejected the request (403). The API key lacks testRun scopes - keys created before n8n 2.30 do not have them; re-create the API key on n8n 2.30+. Other causes: evaluations not licensed on this plan, or the key\'s owner lacks access to this workflow.',
};
const LIST_TEST_RUNS_ERRORS = {
    ...READ_TEST_RUN_BASE,
    notFoundHint: TEST_RUN_WORKFLOW_HINT,
};
const READ_TEST_RUN_ERRORS = {
    ...READ_TEST_RUN_BASE,
    notFoundHint: TEST_RUN_IDS_HINT,
};
const TRIGGER_TEST_RUN_ERRORS = {
    minMinor: 32,
    capability: 'trigger runs from the API',
    scopeHint: testRunWriteScopeHint('testRun:create'),
    notFoundHint: TEST_RUN_WORKFLOW_HINT,
    conflictHint: 'The workflow has no evaluation trigger node. Add an evaluation trigger (n8n-nodes-base.evaluationTrigger) pointing at a dataset, save the workflow, then trigger the run.',
    postRoute: true,
};
const CANCEL_TEST_RUN_ERRORS = {
    minMinor: 32,
    capability: 'cancel runs from the API',
    scopeHint: testRunWriteScopeHint('testRun:cancel'),
    notFoundHint: TEST_RUN_IDS_HINT,
    conflictHint: "The test run already finished (status completed, error, or cancelled), so there is nothing to cancel. Use action='get_run' to see its final state.",
    postRoute: true,
};
async function testRunRouteGate(statusCode, context, options) {
    const client = getN8nApiClient(context);
    const version = client ? await client.refreshVersion().catch(() => null) : null;
    if (version) {
        return (0, n8n_version_1.versionAtLeast)(version, 2, options.minMinor)
            ? null
            : `The evaluation API requires n8n 2.${options.minMinor}.0 or later; this instance runs ${version.version}. Upgrade the instance to ${options.capability}.`;
    }
    const requirement = `This endpoint requires n8n 2.${options.minMinor}.0 or later, and this instance's n8n version could not be read.`;
    return statusCode === 405 && options.postRoute
        ? `${requirement} It rejected POST on the route, which is what an instance predating 2.${options.minMinor}.0 does. Upgrade the instance to ${options.capability}.`
        : `${requirement} Either the instance predates it, or the request simply did not match. ${options.notFoundHint}`;
}
async function handleTestRunError(error, context, options) {
    if (error instanceof zod_1.z.ZodError) {
        return { success: false, error: 'Invalid input', details: { errors: error.errors } };
    }
    if (error instanceof n8n_errors_1.N8nApiError) {
        if (error.statusCode === 402) {
            return { success: false, error: TEST_RUN_QUOTA_HINT, code: error.code };
        }
        if (error.statusCode === 403) {
            return { success: false, error: options.scopeHint, code: error.code };
        }
        if (error.statusCode === 409 && options.conflictHint) {
            return { success: false, error: options.conflictHint, code: error.code };
        }
        if (error.statusCode === 404 || error.statusCode === 405) {
            const gate = await testRunRouteGate(error.statusCode, context, options);
            if (gate) {
                return { success: false, error: gate, code: error.code };
            }
        }
        if (error.statusCode === 404) {
            return { success: false, error: options.notFoundHint, code: error.code };
        }
        return { success: false, error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error), code: error.code };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
}
async function handleListTestRuns(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = listTestRunsSchema.parse(args || {});
        const response = await client.listTestRuns(input.workflowId, {
            status: input.status,
            limit: input.limit,
            cursor: input.cursor,
        });
        const note = response.data.length === 0
            ? (input.status
                ? `No test runs with status '${input.status}' for this workflow.`
                : 'No test runs. Runs exist only for workflows with an evaluation trigger that have been executed at least once.')
            : response.nextCursor
                ? 'More test runs available. Use cursor to get next page.'
                : undefined;
        return {
            success: true,
            data: {
                testRuns: response.data,
                returned: response.data.length,
                nextCursor: response.nextCursor,
                hasMore: !!response.nextCursor,
                ...(note ? { _note: note } : {})
            }
        };
    }
    catch (error) {
        return handleTestRunError(error, context, LIST_TEST_RUNS_ERRORS);
    }
}
async function handleGetTestRun(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = getTestRunSchema.parse(args || {});
        const response = await client.getTestRun(input.workflowId, input.runId);
        return {
            success: true,
            data: response
        };
    }
    catch (error) {
        return handleTestRunError(error, context, READ_TEST_RUN_ERRORS);
    }
}
async function handleListTestCases(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = listTestCasesSchema.parse(args || {});
        const response = await client.listTestCases(input.workflowId, input.runId, {
            limit: input.limit || 20,
            cursor: input.cursor,
        });
        return {
            success: true,
            data: {
                testCases: response.data,
                returned: response.data.length,
                nextCursor: response.nextCursor,
                hasMore: !!response.nextCursor,
                ...(response.nextCursor ? {
                    _note: 'More test cases available. Paginate rather than raising limit - per-case inputs/outputs can be large.'
                } : {})
            }
        };
    }
    catch (error) {
        return handleTestRunError(error, context, READ_TEST_RUN_ERRORS);
    }
}
async function handleTriggerTestRun(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = triggerTestRunSchema.parse(args || {});
        const response = await client.triggerTestRun(input.workflowId);
        return {
            success: true,
            data: {
                ...response,
                _note: `Run started. Cases execute asynchronously - poll with action='get_run', runId='${response.id}' until status is completed, error, or cancelled.`
            }
        };
    }
    catch (error) {
        return handleTestRunError(error, context, TRIGGER_TEST_RUN_ERRORS);
    }
}
async function handleCancelTestRun(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = cancelTestRunSchema.parse(args || {});
        const response = await client.cancelTestRun(input.workflowId, input.runId);
        return {
            success: true,
            data: {
                ...response,
                _note: "Cancellation accepted. In-flight cases stop asynchronously - use action='get_run' to confirm the run reached status 'cancelled'."
            }
        };
    }
    catch (error) {
        return handleTestRunError(error, context, CANCEL_TEST_RUN_ERRORS);
    }
}
async function handleHealthCheck(context) {
    const startTime = Date.now();
    try {
        const client = ensureApiConfigured(context);
        const health = await client.healthCheck();
        const packageJson = require('../../package.json');
        const mcpVersion = packageJson.version;
        const supportedN8nVersion = packageJson.dependencies?.n8n?.replace(/[^0-9.]/g, '');
        const versionCheck = await (0, npm_version_checker_1.checkNpmVersion)();
        const cacheMetricsData = getInstanceCacheMetrics();
        const responseTime = Date.now() - startTime;
        const responseData = {
            status: health.status,
            instanceId: health.instanceId,
            n8nVersion: health.n8nVersion,
            ...(health.n8nVersion ? {} : { n8nVersionNote: n8n_version_1.N8N_VERSION_UNAVAILABLE_NOTE }),
            features: health.features,
            apiUrl: resolveN8nApiConfigForResponse(context)?.baseUrl,
            mcpVersion,
            supportedN8nVersion,
            versionCheck: {
                current: versionCheck.currentVersion,
                latest: versionCheck.latestVersion,
                upToDate: !versionCheck.isOutdated,
                message: (0, npm_version_checker_1.formatVersionMessage)(versionCheck),
                ...(versionCheck.updateCommand ? { updateCommand: versionCheck.updateCommand } : {})
            },
            performance: {
                responseTimeMs: responseTime,
                cacheHitRate: (cacheMetricsData.hits + cacheMetricsData.misses) > 0
                    ? ((cacheMetricsData.hits / (cacheMetricsData.hits + cacheMetricsData.misses)) * 100).toFixed(2) + '%'
                    : 'N/A',
                cachedInstances: cacheMetricsData.size
            }
        };
        responseData.officialMcp = await (0, official_mcp_access_1.buildOfficialMcpHealth)(context, false);
        responseData.nextSteps = [
            '• Create workflow: n8n_create_workflow',
            '• List workflows: n8n_list_workflows',
            '• Search nodes: search_nodes',
            '• Browse templates: search_templates'
        ];
        if (versionCheck.isOutdated && versionCheck.latestVersion) {
            responseData.updateWarning = `⚠️  n8n-mcp v${versionCheck.latestVersion} is available (you have v${versionCheck.currentVersion}). Update recommended.`;
        }
        telemetry_1.telemetry.trackEvent('health_check_completed', {
            success: true,
            responseTimeMs: responseTime,
            upToDate: !versionCheck.isOutdated,
            apiConnected: true
        });
        return {
            success: true,
            data: responseData
        };
    }
    catch (error) {
        const responseTime = Date.now() - startTime;
        telemetry_1.telemetry.trackEvent('health_check_failed', {
            success: false,
            responseTimeMs: responseTime,
            errorType: error instanceof n8n_errors_1.N8nApiError ? error.code : 'unknown'
        });
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code,
                details: {
                    apiUrl: resolveN8nApiConfigForResponse(context)?.baseUrl,
                    hint: 'Check if n8n is running and API is enabled',
                    troubleshooting: [
                        '1. Verify n8n instance is running',
                        '2. Check N8N_API_URL is correct',
                        '3. Verify N8N_API_KEY has proper permissions',
                        '4. Run n8n_health_check with mode="diagnostic" for detailed analysis'
                    ]
                }
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
function detectCloudPlatform() {
    if (process.env.RAILWAY_ENVIRONMENT)
        return 'railway';
    if (process.env.RENDER)
        return 'render';
    if (process.env.FLY_APP_NAME)
        return 'fly';
    if (process.env.HEROKU_APP_NAME)
        return 'heroku';
    if (process.env.AWS_EXECUTION_ENV)
        return 'aws';
    if (process.env.KUBERNETES_SERVICE_HOST)
        return 'kubernetes';
    if (process.env.GOOGLE_CLOUD_PROJECT)
        return 'gcp';
    if (process.env.AZURE_FUNCTIONS_ENVIRONMENT)
        return 'azure';
    return null;
}
function getModeSpecificDebug(mcpMode) {
    if (mcpMode === 'http') {
        const port = process.env.MCP_PORT || process.env.PORT || 3000;
        return {
            mode: 'HTTP Server',
            port,
            authTokenConfigured: !!(process.env.MCP_AUTH_TOKEN || process.env.AUTH_TOKEN),
            corsEnabled: true,
            serverUrl: `http://localhost:${port}`,
            healthCheckUrl: `http://localhost:${port}/health`,
            troubleshooting: [
                `1. Test server health: curl http://localhost:${port}/health`,
                '2. Check browser console for CORS errors',
                '3. Verify MCP_AUTH_TOKEN or AUTH_TOKEN if authentication enabled',
                `4. Ensure port ${port} is not in use: lsof -i :${port} (macOS/Linux) or netstat -ano | findstr :${port} (Windows)`,
                '5. Check firewall settings for port access',
                '6. Review server logs for connection errors'
            ],
            commonIssues: [
                'CORS policy blocking browser requests',
                'Port already in use by another application',
                'Authentication token mismatch',
                'Network firewall blocking connections'
            ]
        };
    }
    else {
        const configLocation = process.platform === 'darwin'
            ? '~/Library/Application Support/Claude/claude_desktop_config.json'
            : process.platform === 'win32'
                ? '%APPDATA%\\Claude\\claude_desktop_config.json'
                : '~/.config/Claude/claude_desktop_config.json';
        return {
            mode: 'Standard I/O (Claude Desktop)',
            configLocation,
            troubleshooting: [
                '1. Verify Claude Desktop config file exists and is valid JSON',
                '2. Check MCP server entry: {"mcpServers": {"n8n": {"command": "npx", "args": ["-y", "n8n-mcp"]}}}',
                '3. Restart Claude Desktop after config changes',
                '4. Check Claude Desktop logs for startup errors',
                '5. Test npx can run: npx -y n8n-mcp --version',
                '6. Verify executable permissions if using local installation'
            ],
            commonIssues: [
                'Invalid JSON in claude_desktop_config.json',
                'Incorrect command or args in MCP server config',
                'Claude Desktop not restarted after config changes',
                'npx unable to download or run package',
                'Missing execute permissions on local binary'
            ]
        };
    }
}
function getDockerDebug(isDocker) {
    if (!isDocker)
        return null;
    return {
        containerDetected: true,
        troubleshooting: [
            '1. Verify volume mounts for data/nodes.db',
            '2. Check network connectivity to n8n instance',
            '3. Ensure ports are correctly mapped',
            '4. Review container logs: docker logs <container-name>',
            '5. Verify environment variables passed to container',
            '6. Check IS_DOCKER=true is set correctly'
        ],
        commonIssues: [
            'Volume mount not persisting database',
            'Network isolation preventing n8n API access',
            'Port mapping conflicts',
            'Missing environment variables in container'
        ]
    };
}
function getCloudPlatformDebug(cloudPlatform) {
    if (!cloudPlatform)
        return null;
    const platformGuides = {
        railway: {
            name: 'Railway',
            troubleshooting: [
                '1. Check Railway environment variables are set',
                '2. Verify deployment logs in Railway dashboard',
                '3. Ensure PORT matches Railway assigned port (automatic)',
                '4. Check networking configuration for external access'
            ]
        },
        render: {
            name: 'Render',
            troubleshooting: [
                '1. Verify Render environment variables',
                '2. Check Render logs for startup errors',
                '3. Ensure health check endpoint is responding',
                '4. Verify instance type has sufficient resources'
            ]
        },
        fly: {
            name: 'Fly.io',
            troubleshooting: [
                '1. Check Fly.io logs: flyctl logs',
                '2. Verify fly.toml configuration',
                '3. Ensure volumes are properly mounted',
                '4. Check app status: flyctl status'
            ]
        },
        heroku: {
            name: 'Heroku',
            troubleshooting: [
                '1. Check Heroku logs: heroku logs --tail',
                '2. Verify Procfile configuration',
                '3. Ensure dynos are running: heroku ps',
                '4. Check environment variables: heroku config'
            ]
        },
        kubernetes: {
            name: 'Kubernetes',
            troubleshooting: [
                '1. Check pod logs: kubectl logs <pod-name>',
                '2. Verify service and ingress configuration',
                '3. Check persistent volume claims',
                '4. Verify resource limits and requests'
            ]
        },
        aws: {
            name: 'AWS',
            troubleshooting: [
                '1. Check CloudWatch logs',
                '2. Verify IAM roles and permissions',
                '3. Check security groups and networking',
                '4. Verify environment variables in service config'
            ]
        }
    };
    return platformGuides[cloudPlatform] || {
        name: cloudPlatform.toUpperCase(),
        troubleshooting: [
            '1. Check cloud platform logs',
            '2. Verify environment variables are set',
            '3. Check networking and port configuration',
            '4. Review platform-specific documentation'
        ]
    };
}
async function handleDiagnostic(request, context) {
    const startTime = Date.now();
    const verbose = request.params?.arguments?.verbose || false;
    const mcpMode = process.env.MCP_MODE || 'stdio';
    const isDocker = process.env.IS_DOCKER === 'true';
    const cloudPlatform = detectCloudPlatform();
    const isMultiTenant = process.env.ENABLE_MULTI_TENANT === 'true';
    const envVars = {
        N8N_API_URL: isMultiTenant ? null : (process.env.N8N_API_URL || null),
        N8N_API_KEY: isMultiTenant ? null : (process.env.N8N_API_KEY ? '***configured***' : null),
        NODE_ENV: process.env.NODE_ENV || 'production',
        MCP_MODE: mcpMode,
        isDocker,
        cloudPlatform,
        nodeVersion: process.version,
        platform: process.platform
    };
    const workspaceManager = (0, workspace_api_client_1.getWorkspaceApiClientManager)();
    const availableWorkspaces = workspaceManager.getAvailableWorkspaces();
    const defaultWorkspace = workspaceManager.getDefaultWorkspace();
    const isMultiWorkspace = workspaceManager.isMultiWorkspace();
    const apiConfig = (0, n8n_api_1.getN8nApiConfig)();
    const apiConfigured = apiConfig !== null || availableWorkspaces.length > 0;
    const apiClient = getN8nApiClient(context);
    let apiStatus = {
        configured: apiConfigured,
        connected: false,
        error: null,
        version: null
    };
    if (apiClient) {
        try {
            const health = await apiClient.healthCheck();
            apiStatus.connected = true;
            apiStatus.version = health.n8nVersion || n8n_version_1.N8N_VERSION_UNAVAILABLE_NOTE;
        }
        catch (error) {
            apiStatus.error = error instanceof Error ? error.message : 'Unknown error';
        }
    }
    const documentationTools = 7;
    const managementTools = apiConfigured ? 18 : 0;
    const totalTools = documentationTools + managementTools;
    const versionCheck = await (0, npm_version_checker_1.checkNpmVersion)();
    const cacheMetricsData = getInstanceCacheMetrics();
    const responseTime = Date.now() - startTime;
    const diagnostic = {
        timestamp: new Date().toISOString(),
        environment: envVars,
        apiConfiguration: {
            configured: apiConfigured,
            status: apiStatus,
            config: apiConfig ? {
                baseUrl: apiConfig.baseUrl,
                timeout: apiConfig.timeout,
                maxRetries: apiConfig.maxRetries
            } : null,
            workspaceMode: availableWorkspaces.length === 0 ? 'none'
                : availableWorkspaces.length === 1 ? 'single'
                    : 'multi',
            workspaces: availableWorkspaces.length > 0 ? {
                available: availableWorkspaces,
                default: defaultWorkspace,
                count: availableWorkspaces.length
            } : null,
            activeContext: context ? {
                url: context.n8nApiUrl?.replace(/^(https?:\/\/[^\/]+).*/, '$1'),
                instanceId: context.instanceId
            } : (defaultWorkspace ? `Using default workspace: ${defaultWorkspace}` : 'No context available')
        },
        versionInfo: {
            current: versionCheck.currentVersion,
            latest: versionCheck.latestVersion,
            upToDate: !versionCheck.isOutdated,
            message: (0, npm_version_checker_1.formatVersionMessage)(versionCheck),
            ...(versionCheck.updateCommand ? { updateCommand: versionCheck.updateCommand } : {})
        },
        toolsAvailability: {
            documentationTools: {
                count: documentationTools,
                enabled: true,
                description: 'Always available - node info, search, validation, etc.'
            },
            managementTools: {
                count: managementTools,
                enabled: apiConfigured,
                description: apiConfigured ?
                    (isMultiWorkspace
                        ? `Management tools are ENABLED - using ${availableWorkspaces.length} workspaces${defaultWorkspace ? ` (default: ${defaultWorkspace})` : ''}`
                        : 'Management tools are ENABLED - create, update, execute workflows')
                    : 'Management tools are DISABLED - configure N8N_URL_* and N8N_TOKEN_* env vars (or N8N_API_URL + N8N_API_KEY for single instance)'
            },
            totalAvailable: totalTools
        },
        performance: {
            diagnosticResponseTimeMs: responseTime,
            cacheHitRate: (cacheMetricsData.hits + cacheMetricsData.misses) > 0
                ? ((cacheMetricsData.hits / (cacheMetricsData.hits + cacheMetricsData.misses)) * 100).toFixed(2) + '%'
                : 'N/A',
            cachedInstances: cacheMetricsData.size
        },
        modeSpecificDebug: getModeSpecificDebug(mcpMode)
    };
    diagnostic.officialMcp = await (0, official_mcp_access_1.buildOfficialMcpHealth)(context, true);
    if (apiConfigured && apiStatus.connected) {
        diagnostic.nextSteps = {
            message: '✓ API connected! Here\'s what you can do:',
            recommended: [
                {
                    action: 'n8n_list_workflows',
                    description: 'See your existing workflows',
                    timing: 'Fast (6 seconds median)'
                },
                {
                    action: 'n8n_create_workflow',
                    description: 'Create a new workflow',
                    timing: 'Typically 6-14 minutes to build'
                },
                {
                    action: 'search_nodes',
                    description: 'Discover available nodes',
                    timing: 'Fast - explore 500+ nodes'
                },
                {
                    action: 'search_templates',
                    description: 'Browse pre-built workflows',
                    timing: 'Find examples quickly'
                }
            ],
            tips: [
                '82% of users start creating workflows after diagnostics - you\'re ready to go!',
                'Most common first action: n8n_update_partial_workflow (managing existing workflows)',
                'Use n8n_validate_workflow before deploying to catch issues early'
            ]
        };
    }
    else if (apiConfigured && !apiStatus.connected) {
        diagnostic.troubleshooting = {
            issue: '⚠️ API configured but connection failed',
            error: apiStatus.error,
            steps: [
                '1. Verify n8n instance is running and accessible',
                '2. Check N8N_API_URL is correct (currently: ' + apiConfig?.baseUrl + ')',
                '3. Test URL in browser: ' + apiConfig?.baseUrl + '/healthz',
                '4. Verify N8N_API_KEY has proper permissions',
                '5. Check firewall/network settings if using remote n8n',
                '6. Try running n8n_health_check again after fixes'
            ],
            commonIssues: [
                'Wrong port number in N8N_API_URL',
                'API key doesn\'t have sufficient permissions',
                'n8n instance not running or crashed',
                'Network firewall blocking connection'
            ],
            documentation: 'https://github.com/czlonkowski/n8n-mcp?tab=readme-ov-file#n8n-management-tools-optional---requires-api-configuration'
        };
    }
    else {
        diagnostic.setupGuide = {
            message: 'n8n API not configured. You can still use documentation tools!',
            whatYouCanDoNow: {
                documentation: [
                    {
                        tool: 'search_nodes',
                        description: 'Search 500+ n8n nodes',
                        example: 'search_nodes({query: "slack"})'
                    },
                    {
                        tool: 'get_node_essentials',
                        description: 'Get node configuration details',
                        example: 'get_node_essentials({nodeType: "nodes-base.httpRequest"})'
                    },
                    {
                        tool: 'search_templates',
                        description: 'Browse workflow templates',
                        example: 'search_templates({query: "chatbot"})'
                    },
                    {
                        tool: 'validate_workflow',
                        description: 'Validate workflow JSON',
                        example: 'validate_workflow({workflow: {...}})'
                    }
                ],
                note: '14 documentation tools available without API configuration'
            },
            whatYouCannotDo: [
                '✗ Create/update workflows in n8n instance',
                '✗ List your workflows',
                '✗ Execute workflows',
                '✗ View execution results'
            ],
            howToEnable: {
                steps: [
                    '1. Get your n8n API key: [Your n8n instance]/settings/api',
                    '2. Set environment variables:',
                    '   N8N_API_URL=https://your-n8n-instance.com',
                    '   N8N_API_KEY=your_api_key_here',
                    '3. Restart the MCP server',
                    '4. Run n8n_health_check with mode="diagnostic" to verify',
                    '5. All 19 tools will be available!'
                ],
                documentation: 'https://github.com/czlonkowski/n8n-mcp?tab=readme-ov-file#n8n-management-tools-optional---requires-api-configuration'
            }
        };
    }
    if (versionCheck.isOutdated && versionCheck.latestVersion) {
        diagnostic.updateWarning = {
            message: `⚠️ Update available: v${versionCheck.currentVersion} → v${versionCheck.latestVersion}`,
            command: versionCheck.updateCommand,
            benefits: [
                'Latest bug fixes and improvements',
                'New features and tools',
                'Better performance and reliability'
            ]
        };
    }
    const dockerDebug = getDockerDebug(isDocker);
    if (dockerDebug) {
        diagnostic.dockerDebug = dockerDebug;
    }
    const cloudDebug = getCloudPlatformDebug(cloudPlatform);
    if (cloudDebug) {
        diagnostic.cloudPlatformDebug = cloudDebug;
    }
    if (verbose) {
        diagnostic.debug = {
            processEnv: Object.keys(process.env).filter(key => key.startsWith('N8N_') || key.startsWith('MCP_')),
            nodeVersion: process.version,
            platform: process.platform,
            workingDirectory: process.cwd(),
            cacheMetrics: cacheMetricsData
        };
    }
    telemetry_1.telemetry.trackEvent('diagnostic_completed', {
        success: true,
        apiConfigured,
        apiConnected: apiStatus.connected,
        toolsAvailable: totalTools,
        responseTimeMs: responseTime,
        upToDate: !versionCheck.isOutdated,
        verbose
    });
    return {
        success: true,
        data: diagnostic
    };
}
const VERSIONS_ACTION = 'workflow_versions';
const VERSIONS_TIMEOUT_MS = 30000;
const NATIVE_VERSIONS_LIMIT_CAP = 50;
const NATIVE_VALIDATION_NOTE = 'not available for native versions';
function withDiffFormat(data, format) {
    return data && typeof data === 'object' && !Array.isArray(data)
        ? { ...data, format }
        : { diff: data, format };
}
const LOCAL_VERSION_ID_PATTERN = /^-?\d+$/;
function parseLocalVersionId(value, field) {
    if (value === undefined)
        return { ok: true, value: undefined };
    if (typeof value === 'string' && value.trim() === '') {
        return { ok: false, error: `${field} must be an integer version id for source: local` };
    }
    if (typeof value === 'string' && !LOCAL_VERSION_ID_PATTERN.test(value.trim())) {
        return {
            ok: false,
            error: `${field} must be an integer version id for source: local (got ${JSON.stringify(value)}). n8n's own string version ids need source: native.`,
        };
    }
    const parsed = typeof value === 'number' ? value : Number(value.trim());
    if (!Number.isInteger(parsed)) {
        return {
            ok: false,
            error: `${field} must be an integer version id for source: local (got ${JSON.stringify(value)}). n8n's own string version ids need source: native.`,
        };
    }
    return { ok: true, value: parsed };
}
async function handleNativeWorkflowVersions(input, context) {
    const mode = input.mode;
    const label = (response) => ({
        ...response,
        mode,
        source: 'native',
        backend: 'official-mcp',
    });
    const invalid = (error) => label({ success: false, action: VERSIONS_ACTION, code: 'INVALID_ARGS', error });
    if (mode === 'delete' || mode === 'prune') {
        return label({
            success: false,
            action: VERSIONS_ACTION,
            code: 'MODE_NOT_SUPPORTED_FOR_SOURCE',
            error: `n8n's own version history cannot be ${mode === 'delete' ? 'deleted' : 'pruned'} through MCP; use source: local for n8n-mcp snapshots`,
        });
    }
    const workflowId = input.workflowId;
    if (!workflowId) {
        return invalid(`workflowId is required for source: native (mode: ${mode})`);
    }
    if (mode !== 'list' && input.versionId === undefined) {
        return invalid(`versionId is required for mode: ${mode}`);
    }
    if (mode === 'diff' && input.toVersionId === undefined) {
        return invalid('toVersionId is required for mode: diff');
    }
    const versionId = input.versionId === undefined ? undefined : String(input.versionId);
    const toVersionId = input.toVersionId === undefined ? undefined : String(input.toVersionId);
    let aliases;
    let officialArgs;
    let idempotent = true;
    switch (mode) {
        case 'list':
            aliases = ['get_workflow_history'];
            officialArgs = {
                workflowId,
                limit: Math.max(1, Math.min(NATIVE_VERSIONS_LIMIT_CAP, Math.floor(input.limit ?? 10))),
                offset: Math.max(0, Math.floor(input.offset ?? 0)),
            };
            break;
        case 'get':
            aliases = ['get_workflow_version'];
            officialArgs = { workflowId, versionId };
            break;
        case 'diff':
            aliases = ['get_workflow_versions_diff'];
            officialArgs = { workflowId, fromVersionId: versionId, toVersionId };
            break;
        case 'rollback':
            aliases = ['restore_workflow_version'];
            officialArgs = { workflowId, versionId };
            idempotent = false;
            break;
        default:
            return invalid(`Unknown mode: ${mode}`);
    }
    const response = await (0, mcp_exposure_1.withMcpExposure)({
        apiClient: getN8nApiClient(context),
        workflowId,
        exposeToMcp: input.exposeToMcp,
        action: VERSIONS_ACTION,
        toolName: 'n8n_workflow_versions',
        context,
    }, () => (0, handlers_official_tools_1.callOfficialTool)(context, aliases, officialArgs, input.timeoutMs ?? VERSIONS_TIMEOUT_MS, VERSIONS_ACTION, idempotent));
    const labelled = label(response);
    if (mode === 'diff' && labelled.success) {
        labelled.data = withDiffFormat(labelled.data, 'n8n');
    }
    if (mode === 'rollback' && labelled.success) {
        labelled.validation = NATIVE_VALIDATION_NOTE;
    }
    return labelled;
}
async function handleLocalWorkflowVersions(input, versionId, toVersionId, repository, context) {
    const client = getN8nApiClient(context);
    const versioningService = new workflow_versioning_service_1.WorkflowVersioningService(repository, client || undefined, (0, instance_context_1.getInstanceScopeId)(context));
    switch (input.mode) {
        case 'list': {
            if (!input.workflowId) {
                return {
                    success: false,
                    error: 'workflowId is required for list mode'
                };
            }
            const versions = await versioningService.getVersionHistory(input.workflowId, input.limit);
            return {
                success: true,
                data: {
                    workflowId: input.workflowId,
                    versions,
                    count: versions.length,
                    message: `Found ${versions.length} version(s) for workflow ${input.workflowId}`
                }
            };
        }
        case 'get': {
            if (!versionId) {
                return {
                    success: false,
                    error: 'versionId is required for get mode'
                };
            }
            const version = await versioningService.getVersion(versionId);
            if (!version) {
                return {
                    success: false,
                    error: `Version ${versionId} not found`
                };
            }
            return {
                success: true,
                data: version
            };
        }
        case 'rollback': {
            if (!input.workflowId) {
                return {
                    success: false,
                    error: 'workflowId is required for rollback mode'
                };
            }
            if (!client) {
                return {
                    success: false,
                    error: 'n8n API not configured. Cannot perform rollback without API access.'
                };
            }
            const result = await versioningService.restoreVersion(input.workflowId, versionId, input.validateBefore);
            return {
                success: result.success,
                data: result.success ? result : undefined,
                error: result.success ? undefined : result.message,
                details: result.success ? undefined : {
                    validationErrors: result.validationErrors
                }
            };
        }
        case 'delete': {
            if (input.deleteAll) {
                if (!input.workflowId) {
                    return {
                        success: false,
                        error: 'workflowId is required for deleteAll mode'
                    };
                }
                const result = await versioningService.deleteAllVersions(input.workflowId);
                return {
                    success: true,
                    data: {
                        workflowId: input.workflowId,
                        deleted: result.deleted,
                        message: result.message
                    }
                };
            }
            else {
                if (!versionId) {
                    return {
                        success: false,
                        error: 'versionId is required for single version delete'
                    };
                }
                const result = await versioningService.deleteVersion(versionId);
                return {
                    success: result.success,
                    data: result.success ? { message: result.message } : undefined,
                    error: result.success ? undefined : result.message
                };
            }
        }
        case 'prune': {
            if (!input.workflowId) {
                return {
                    success: false,
                    error: 'workflowId is required for prune mode'
                };
            }
            const result = await versioningService.pruneVersions(input.workflowId, input.maxVersions || 10);
            return {
                success: true,
                data: {
                    workflowId: input.workflowId,
                    pruned: result.pruned,
                    remaining: result.remaining,
                    message: `Pruned ${result.pruned} old version(s), ${result.remaining} version(s) remaining`
                }
            };
        }
        case 'diff': {
            if (!input.workflowId) {
                return {
                    success: false,
                    error: 'workflowId is required for diff mode'
                };
            }
            if (versionId === undefined || toVersionId === undefined) {
                return {
                    success: false,
                    code: 'INVALID_ARGS',
                    error: 'versionId and toVersionId are both required for diff mode'
                };
            }
            try {
                const diff = await versioningService.compareVersions(versionId, toVersionId, input.workflowId);
                return {
                    success: true,
                    data: withDiffFormat(diff, 'n8n-mcp')
                };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (message.includes(workflow_versioning_service_1.VERSION_OWNERSHIP_ERROR_PREFIX)) {
                    return {
                        success: false,
                        code: 'INVALID_ARGS',
                        error: message
                    };
                }
                throw error;
            }
        }
        default:
            return {
                success: false,
                error: `Unknown mode: ${input.mode}`
            };
    }
}
async function handleWorkflowVersions(args, repository, context) {
    try {
        const input = workflowVersionsSchema.parse(args);
        if (process.env.ENABLE_MULTI_TENANT === 'true' && (0, instance_context_1.getInstanceScopeId)(context) === '') {
            const source = input.source ?? 'local';
            return {
                success: false,
                mode: input.mode,
                source,
                backend: source === 'native' ? 'official-mcp' : 'n8n-mcp',
                error: source === 'native'
                    ? "Reading n8n's own version history needs an instance-scoped context for this tenant"
                    : 'Workflow version storage is not available for this tenant context'
            };
        }
        if ((input.source ?? 'local') === 'native') {
            return handleNativeWorkflowVersions(input, context);
        }
        const invalidLocalVersionId = (error) => ({
            success: false,
            mode: input.mode,
            source: 'local',
            backend: 'n8n-mcp',
            code: 'INVALID_ARGS',
            error,
        });
        const parsedVersionId = parseLocalVersionId(input.versionId, 'versionId');
        if (!parsedVersionId.ok)
            return invalidLocalVersionId(parsedVersionId.error);
        const parsedToVersionId = parseLocalVersionId(input.toVersionId, 'toVersionId');
        if (!parsedToVersionId.ok)
            return invalidLocalVersionId(parsedToVersionId.error);
        const versionId = parsedVersionId.value;
        const toVersionId = parsedToVersionId.value;
        const localResult = await handleLocalWorkflowVersions(input, versionId, toVersionId, repository, context);
        return { ...localResult, mode: input.mode, source: 'local', backend: 'n8n-mcp' };
    }
    catch (error) {
        const raw = (args && typeof args === 'object' ? args : {});
        const source = raw.source === 'native' ? 'native' : 'local';
        const label = {
            ...(typeof raw.mode === 'string' ? { mode: raw.mode } : {}),
            source,
            backend: source === 'native' ? 'official-mcp' : 'n8n-mcp',
        };
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                ...label,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        return {
            success: false,
            ...label,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
const deployTemplateSchema = zod_1.z.object({
    templateId: zod_1.z.number().positive().int(),
    name: zod_1.z.string().optional(),
    autoUpgradeVersions: zod_1.z.boolean().default(true),
    autoFix: zod_1.z.boolean().default(true),
    stripCredentials: zod_1.z.boolean().default(true)
});
async function handleDeployTemplate(args, templateService, repository, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = deployTemplateSchema.parse(args);
        const template = await templateService.getTemplate(input.templateId, 'full');
        if (!template) {
            return {
                success: false,
                error: `Template ${input.templateId} not found`,
                details: {
                    hint: 'Use search_templates to find available templates',
                    templateUrl: `https://n8n.io/workflows/${input.templateId}`
                }
            };
        }
        const workflow = JSON.parse(JSON.stringify(template.workflow));
        if (!workflow || !workflow.nodes) {
            return {
                success: false,
                error: 'Template has invalid workflow structure',
                details: { templateId: input.templateId }
            };
        }
        const workflowName = input.name || template.name;
        const requiredCredentials = [];
        for (const node of workflow.nodes) {
            if (node.credentials && typeof node.credentials === 'object') {
                for (const [credType] of Object.entries(node.credentials)) {
                    requiredCredentials.push({
                        nodeType: node.type,
                        nodeName: node.name,
                        credentialType: credType
                    });
                }
            }
        }
        if (input.stripCredentials) {
            workflow.nodes = workflow.nodes.map((node) => {
                const { credentials, ...rest } = node;
                return rest;
            });
        }
        if (input.autoUpgradeVersions) {
            const autoFixer = new workflow_auto_fixer_1.WorkflowAutoFixer(repository);
            const validator = new workflow_validator_1.WorkflowValidator(repository, enhanced_config_validator_1.EnhancedConfigValidator);
            const validationResult = await validator.validateWorkflow(workflow, {
                validateNodes: true,
                validateConnections: false,
                validateExpressions: false,
                profile: 'runtime'
            });
            const fixResult = await autoFixer.generateFixes(workflow, validationResult, [], { fixTypes: ['typeversion-upgrade', 'typeversion-correction'] });
            if (fixResult.operations.length > 0) {
                for (const op of fixResult.operations) {
                    if (op.type === 'updateNode' && op.updates) {
                        const node = workflow.nodes.find((n) => n.id === op.nodeId || n.name === op.nodeName);
                        if (node) {
                            for (const [path, value] of Object.entries(op.updates)) {
                                if (path === 'typeVersion') {
                                    node.typeVersion = value;
                                }
                            }
                        }
                    }
                }
            }
        }
        const triggerNode = workflow.nodes.find((n) => n.type?.includes('Trigger') ||
            n.type?.includes('webhook') ||
            n.type === 'n8n-nodes-base.webhook');
        const triggerType = triggerNode?.type?.split('.').pop() || 'manual';
        const templateGroupWarnings = [];
        const createdWorkflow = await client.createWorkflow({
            name: workflowName,
            nodes: workflow.nodes,
            connections: workflow.connections,
            ...(0, node_groups_1.nodeGroupsField)(workflow.nodeGroups),
            settings: workflow.settings || { executionOrder: 'v1' }
        }, {
            onWarning: message => templateGroupWarnings.push(message)
        });
        const apiConfig = resolveN8nApiConfigForResponse(context);
        const baseUrl = apiConfig?.baseUrl?.replace('/api/v1', '') || '';
        let fixesApplied = [];
        let fixSummary = '';
        let autoFixStatus = 'skipped';
        if (input.autoFix) {
            try {
                const autofixResult = await handleAutofixWorkflow({
                    id: createdWorkflow.id,
                    applyFixes: true,
                    fixTypes: ['expression-format', 'typeversion-upgrade'],
                    confidenceThreshold: 'medium'
                }, repository, context);
                if (autofixResult.success && autofixResult.data) {
                    const fixData = autofixResult.data;
                    autoFixStatus = 'success';
                    if (fixData.fixesApplied && fixData.fixesApplied > 0) {
                        fixesApplied = fixData.fixes || [];
                        fixSummary = ` Auto-fixed ${fixData.fixesApplied} issue(s).`;
                    }
                }
            }
            catch (fixError) {
                autoFixStatus = 'failed';
                logger_1.logger.warn('Auto-fix failed after template deployment', {
                    workflowId: createdWorkflow.id,
                    error: fixError instanceof Error ? fixError.message : 'Unknown error'
                });
                fixSummary = ' Auto-fix failed (workflow deployed successfully).';
            }
        }
        return {
            success: true,
            data: {
                workflowId: createdWorkflow.id,
                name: createdWorkflow.name,
                active: false,
                nodeCount: workflow.nodes.length,
                triggerType,
                requiredCredentials: requiredCredentials.length > 0 ? requiredCredentials : undefined,
                url: baseUrl ? `${baseUrl}/workflow/${createdWorkflow.id}` : undefined,
                templateId: input.templateId,
                templateUrl: template.url || `https://n8n.io/workflows/${input.templateId}`,
                autoFixStatus,
                fixesApplied: fixesApplied.length > 0 ? fixesApplied : undefined,
                warnings: templateGroupWarnings.length > 0 ? templateGroupWarnings : undefined
            },
            message: `Workflow "${createdWorkflow.name}" deployed successfully from template ${input.templateId}.${fixSummary} ${requiredCredentials.length > 0
                ? `Configure ${requiredCredentials.length} credential(s) in n8n to activate.`
                : ''}`
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code,
                details: error.details
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
async function handleTriggerWebhookWorkflow(args, context) {
    const triggerWebhookSchema = zod_1.z.object({
        webhookUrl: zod_1.z.string().url(),
        httpMethod: optionalEmptyAware(zod_1.z.enum(['GET', 'POST', 'PUT', 'DELETE'])),
        data: zod_1.z.record(zod_1.z.unknown()).optional(),
        headers: zod_1.z.record(zod_1.z.string()).optional(),
        waitForResponse: zod_1.z.boolean().optional(),
    });
    try {
        const client = ensureApiConfigured(context);
        const input = triggerWebhookSchema.parse(args);
        const webhookRequest = {
            webhookUrl: input.webhookUrl,
            httpMethod: input.httpMethod || 'POST',
            data: input.data,
            headers: input.headers,
            waitForResponse: input.waitForResponse ?? true
        };
        const response = await client.triggerWebhook(webhookRequest);
        return {
            success: true,
            data: response,
            message: 'Webhook triggered successfully'
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid input',
                details: { errors: error.errors }
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            const errorData = error.details;
            const executionId = errorData?.executionId || errorData?.id || errorData?.execution?.id;
            const workflowId = errorData?.workflowId || errorData?.workflow?.id;
            if (executionId) {
                return {
                    success: false,
                    error: (0, n8n_errors_1.formatExecutionError)(executionId, workflowId),
                    code: error.code,
                    executionId,
                    workflowId: workflowId || undefined
                };
            }
            if (error.code === 'SERVER_ERROR' || error.statusCode && error.statusCode >= 500) {
                return {
                    success: false,
                    error: (0, n8n_errors_1.formatNoExecutionError)(),
                    code: error.code
                };
            }
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
                code: error.code,
                details: error.details
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
const dataTableFilterConditionSchema = zod_1.z.object({
    columnName: zod_1.z.string().min(1),
    condition: zod_1.z.enum(['eq', 'neq', 'like', 'ilike', 'gt', 'gte', 'lt', 'lte']),
    value: zod_1.z.any(),
});
const dataTableFilterSchema = zod_1.z.object({
    type: zod_1.z.enum(['and', 'or']).optional().default('and'),
    filters: zod_1.z.array(dataTableFilterConditionSchema).min(1, 'At least one filter condition is required'),
});
const tableIdSchema = zod_1.z.object({
    tableId: zod_1.z.string().min(1, 'tableId is required'),
});
const createTableSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Table name cannot be empty'),
    columns: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1, 'Column name cannot be empty'),
        type: zod_1.z.enum(['string', 'number', 'boolean', 'date']).optional(),
    })).min(1, 'At least one column is required'),
    projectId: optionalEmptyAware(zod_1.z.string()),
});
const listTablesSchema = zod_1.z.object({
    limit: zod_1.z.number().min(1).max(100).optional(),
    cursor: optionalEmptyAware(zod_1.z.string()),
});
const updateTableSchema = tableIdSchema.extend({
    name: zod_1.z.string().min(1, 'New table name cannot be empty'),
});
const coerceJsonArray = zod_1.z.preprocess(tryParseJson, zod_1.z.array(zod_1.z.record(zod_1.z.unknown())));
const coerceJsonObject = zod_1.z.preprocess(tryParseJson, zod_1.z.record(zod_1.z.unknown()));
const coerceJsonFilter = zod_1.z.preprocess(tryParseJson, dataTableFilterSchema);
const getRowsSchema = tableIdSchema.extend({
    limit: zod_1.z.number().min(1).max(100).optional(),
    cursor: optionalEmptyAware(zod_1.z.string()),
    filter: zod_1.z.union([coerceJsonFilter, zod_1.z.string()]).optional(),
    sortBy: optionalEmptyAware(zod_1.z.string()),
    search: optionalEmptyAware(zod_1.z.string()),
});
const insertRowsSchema = tableIdSchema.extend({
    data: coerceJsonArray.pipe(zod_1.z.array(zod_1.z.record(zod_1.z.unknown())).min(1, 'At least one row is required')),
    returnType: zod_1.z.enum(['count', 'id', 'all']).optional(),
});
const mutateRowsSchema = tableIdSchema.extend({
    filter: coerceJsonFilter,
    data: coerceJsonObject,
    returnData: zod_1.z.boolean().optional(),
    dryRun: zod_1.z.boolean().optional(),
});
const deleteRowsSchema = tableIdSchema.extend({
    filter: coerceJsonFilter,
    returnData: zod_1.z.boolean().optional(),
    dryRun: zod_1.z.boolean().optional(),
});
function handleCrudError(error) {
    if (error instanceof zod_1.z.ZodError) {
        return { success: false, error: 'Invalid input', details: { errors: error.errors } };
    }
    if (error instanceof n8n_errors_1.N8nApiError) {
        return {
            success: false,
            error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
            code: error.code,
            details: error.details,
        };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
}
async function handleCreateTable(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = createTableSchema.parse(args);
        const dataTable = await client.createDataTable(input);
        if (!dataTable || !dataTable.id) {
            return { success: false, error: 'Data table creation failed: n8n API returned an empty or invalid response' };
        }
        return {
            success: true,
            data: { id: dataTable.id, name: dataTable.name },
            message: `Data table "${dataTable.name}" created with ID: ${dataTable.id}`,
        };
    }
    catch (error) {
        return handleCrudError(error);
    }
}
async function handleListTables(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = listTablesSchema.parse(args || {});
        const result = await client.listDataTables(input);
        return {
            success: true,
            data: {
                tables: result.data,
                count: result.data.length,
                nextCursor: result.nextCursor || undefined,
            },
        };
    }
    catch (error) {
        return handleCrudError(error);
    }
}
async function handleGetTable(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { tableId } = tableIdSchema.parse(args);
        const dataTable = await client.getDataTable(tableId);
        return { success: true, data: dataTable };
    }
    catch (error) {
        return handleCrudError(error);
    }
}
async function handleUpdateTable(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { tableId, name } = updateTableSchema.parse(args);
        const dataTable = await client.updateDataTable(tableId, { name });
        const rawArgs = args;
        const hasColumns = rawArgs && typeof rawArgs === 'object' && 'columns' in rawArgs;
        return {
            success: true,
            data: dataTable,
            message: `Data table renamed to "${dataTable.name}"` +
                (hasColumns ? '. Note: columns parameter was ignored — table schema is immutable after creation via the public API' : ''),
        };
    }
    catch (error) {
        return handleCrudError(error);
    }
}
async function handleDeleteTable(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { tableId } = tableIdSchema.parse(args);
        await client.deleteDataTable(tableId);
        return { success: true, message: `Data table ${tableId} deleted successfully` };
    }
    catch (error) {
        return handleCrudError(error);
    }
}
async function handleGetRows(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { tableId, filter, sortBy, ...params } = getRowsSchema.parse(args);
        const queryParams = { ...params };
        if (filter) {
            queryParams.filter = typeof filter === 'string' ? filter : JSON.stringify(filter);
        }
        if (sortBy) {
            queryParams.sortBy = sortBy;
        }
        const result = await client.getDataTableRows(tableId, queryParams);
        return {
            success: true,
            data: {
                rows: result.data,
                count: result.data.length,
                nextCursor: result.nextCursor || undefined,
            },
        };
    }
    catch (error) {
        return handleCrudError(error);
    }
}
async function handleInsertRows(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { tableId, ...params } = insertRowsSchema.parse(args);
        const result = await client.insertDataTableRows(tableId, params);
        return {
            success: true,
            data: result,
            message: `Rows inserted into data table ${tableId}`,
        };
    }
    catch (error) {
        return handleCrudError(error);
    }
}
async function handleUpdateRows(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { tableId, ...params } = mutateRowsSchema.parse(args);
        const result = await client.updateDataTableRows(tableId, params);
        return {
            success: true,
            data: result,
            message: params.dryRun ? 'Dry run: rows matched (no changes applied)' : 'Rows updated successfully',
        };
    }
    catch (error) {
        return handleCrudError(error);
    }
}
async function handleUpsertRows(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { tableId, ...params } = mutateRowsSchema.parse(args);
        const result = await client.upsertDataTableRow(tableId, params);
        return {
            success: true,
            data: result,
            message: params.dryRun ? 'Dry run: upsert previewed (no changes applied)' : 'Row upserted successfully',
        };
    }
    catch (error) {
        return handleCrudError(error);
    }
}
async function handleDeleteRows(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { tableId, filter, ...params } = deleteRowsSchema.parse(args);
        const queryParams = {
            filter: JSON.stringify(filter),
            ...params,
        };
        const result = await client.deleteDataTableRows(tableId, queryParams);
        const cleanedResult = params.dryRun && Array.isArray(result)
            ? result.filter((row) => row?.dryRunState !== 'after')
            : result;
        return {
            success: true,
            data: cleanedResult,
            message: params.dryRun ? 'Dry run: rows matched for deletion (no changes applied)' : 'Rows deleted successfully',
        };
    }
    catch (error) {
        return handleCrudError(error);
    }
}
const DATATABLE_ACTION = 'manage_datatable';
const DATATABLE_TIMEOUT_MS = agents_action_map_1.DEFAULT_TIMEOUT_MS;
const COLUMN_TOOLS = {
    addColumn: ['add_data_table_column'],
    deleteColumn: ['delete_data_table_column'],
    renameColumn: ['rename_data_table_column'],
};
const columnNameSchema = zod_1.z
    .string()
    .min(1, 'Column name cannot be empty')
    .max(63, 'Column name must be at most 63 characters')
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Column name must start with a letter and contain only letters, digits and underscores');
const columnTargetSchema = tableIdSchema.extend({
    projectId: optionalEmptyAware(zod_1.z.string()),
    timeoutMs: zod_1.z.number().int().min(agents_action_map_1.MIN_TIMEOUT_MS).max(agents_action_map_1.MAX_TIMEOUT_MS).optional(),
});
const addColumnSchema = columnTargetSchema.extend({
    column: zod_1.z.preprocess(tryParseJson, zod_1.z.object({
        name: columnNameSchema,
        type: zod_1.z.enum(['string', 'number', 'boolean', 'date']),
    })),
});
const deleteColumnSchema = columnTargetSchema.extend({
    columnId: zod_1.z.string().min(1, 'columnId is required'),
});
const renameColumnSchema = deleteColumnSchema.extend({
    name: columnNameSchema,
});
function columnInvalidArgs(action, error) {
    return {
        success: false,
        action,
        code: 'INVALID_ARGS',
        error: error.issues.map(i => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '),
    };
}
async function resolveDataTableProjectId(input, action, context) {
    if (input.projectId)
        return { projectId: input.projectId };
    const resolved = await (0, handlers_official_tools_1.resolveProjectChoices)(context);
    if ('failure' in resolved)
        return { failure: { ...resolved.failure, action } };
    const items = resolved.choices.items;
    if (items.length === 1)
        return { projectId: items[0].id };
    const backend = resolved.choices.backend;
    if (items.length === 0) {
        return {
            failure: {
                success: false,
                action,
                backend,
                code: 'PROJECT_REQUIRED',
                error: 'No project could be resolved for this instance; pass projectId',
            },
        };
    }
    return {
        failure: {
            success: false,
            action,
            backend,
            code: 'PROJECT_REQUIRED',
            error: 'Several projects are accessible; pass projectId',
            details: { candidates: items },
        },
    };
}
async function callColumnTool(action, officialArgs, timeoutMs, context) {
    const response = await (0, handlers_official_tools_1.callOfficialTool)(context, COLUMN_TOOLS[action], officialArgs, timeoutMs ?? DATATABLE_TIMEOUT_MS, DATATABLE_ACTION, false);
    return { ...response, action, backend: 'official-mcp' };
}
async function handleAddColumn(args, context) {
    const parsed = addColumnSchema.safeParse(args);
    if (!parsed.success)
        return columnInvalidArgs('addColumn', parsed.error);
    const resolved = await resolveDataTableProjectId(parsed.data, 'addColumn', context);
    if ('failure' in resolved)
        return resolved.failure;
    return callColumnTool('addColumn', {
        dataTableId: parsed.data.tableId,
        projectId: resolved.projectId,
        name: parsed.data.column.name,
        type: parsed.data.column.type,
    }, parsed.data.timeoutMs, context);
}
async function handleDeleteColumn(args, context) {
    const parsed = deleteColumnSchema.safeParse(args);
    if (!parsed.success)
        return columnInvalidArgs('deleteColumn', parsed.error);
    const resolved = await resolveDataTableProjectId(parsed.data, 'deleteColumn', context);
    if ('failure' in resolved)
        return resolved.failure;
    return callColumnTool('deleteColumn', { dataTableId: parsed.data.tableId, projectId: resolved.projectId, columnId: parsed.data.columnId }, parsed.data.timeoutMs, context);
}
async function handleRenameColumn(args, context) {
    const parsed = renameColumnSchema.safeParse(args);
    if (!parsed.success)
        return columnInvalidArgs('renameColumn', parsed.error);
    const resolved = await resolveDataTableProjectId(parsed.data, 'renameColumn', context);
    if ('failure' in resolved)
        return resolved.failure;
    return callColumnTool('renameColumn', {
        dataTableId: parsed.data.tableId,
        projectId: resolved.projectId,
        columnId: parsed.data.columnId,
        name: parsed.data.name,
    }, parsed.data.timeoutMs, context);
}
const listCredentialsSchema = zod_1.z.object({
    includeUsage: zod_1.z.boolean().optional(),
    cursor: optionalEmptyAware(zod_1.z.string()),
    limit: zod_1.z.number().min(1).max(100).optional(),
}).passthrough();
const getCredentialSchema = zod_1.z.object({
    id: zod_1.z.string({ required_error: 'Credential ID is required' }),
    includeUsage: zod_1.z.boolean().optional(),
});
async function buildCredentialUsageMap(client) {
    const usage = new Map();
    const workflows = await client.listAllWorkflows();
    for (const wf of workflows) {
        if (!wf.id)
            continue;
        const entry = {
            id: wf.id,
            name: wf.name,
            active: wf.active ?? false,
        };
        const seenForThisWorkflow = new Set();
        for (const node of wf.nodes ?? []) {
            if (!node.credentials)
                continue;
            for (const credConfig of Object.values(node.credentials)) {
                const credId = credConfig?.id;
                if (typeof credId !== 'string' || credId === '')
                    continue;
                if (seenForThisWorkflow.has(credId))
                    continue;
                seenForThisWorkflow.add(credId);
                const list = usage.get(credId);
                if (list) {
                    list.push(entry);
                }
                else {
                    usage.set(credId, [entry]);
                }
            }
        }
    }
    return usage;
}
const createCredentialSchema = zod_1.z.object({
    name: zod_1.z.string({ required_error: 'Credential name is required' }),
    type: zod_1.z.string({ required_error: 'Credential type is required' }),
    data: zod_1.z.record(zod_1.z.any(), { required_error: 'Credential data is required' }),
});
const updateCredentialSchema = zod_1.z.object({
    id: zod_1.z.string({ required_error: 'Credential ID is required' }),
    name: zod_1.z.string().optional(),
    type: zod_1.z.string().optional(),
    data: zod_1.z.record(zod_1.z.any()).optional(),
});
const deleteCredentialSchema = zod_1.z.object({
    id: zod_1.z.string({ required_error: 'Credential ID is required' }),
});
const getCredentialSchemaTypeSchema = zod_1.z.object({
    type: zod_1.z.string({ required_error: 'Credential type is required' }),
});
function stripCredentialData(credential) {
    const { data: _sensitiveData, ...safeCred } = credential;
    return safeCred;
}
function isCredentialReadUnsupported(error) {
    if (typeof error !== 'object' || error === null) {
        return false;
    }
    const status = error.statusCode;
    if (status === 405 || status === 403) {
        return true;
    }
    if (status !== undefined) {
        return false;
    }
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return message.includes('not allowed');
}
function credentialReadUnsupportedResponse(error) {
    return {
        success: false,
        error: 'This n8n instance\'s public API rejected the credential read. On older n8n versions the public API ' +
            'does not expose GET /credentials at all; on newer ones this can mean the API key or instance settings ' +
            'do not permit credential reads. The create, delete, and getSchema actions generally still work, and ' +
            'update does too where the API version supports it (it needs a known credential ID, not list/get). ' +
            'To find an existing credential\'s ID, open it in the n8n UI — the ID is in the URL.',
        code: 'NOT_SUPPORTED',
        details: {
            statusCode: error.statusCode,
            cause: error instanceof Error ? error.message : String(error),
        },
    };
}
async function handleListCredentials(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { includeUsage, cursor, limit } = listCredentialsSchema.parse(args);
        if (includeUsage) {
            const allCredentials = await client.listAllCredentials();
            let credentials = allCredentials.map(stripCredentialData);
            let usageScanError;
            try {
                const usageMap = await buildCredentialUsageMap(client);
                credentials = credentials.map((cred) => {
                    const usedIn = (cred.id ? usageMap.get(cred.id) : undefined) ?? [];
                    return { ...cred, usedIn, usageCount: usedIn.length };
                });
            }
            catch (scanError) {
                usageScanError = scanError instanceof Error ? scanError.message : String(scanError);
            }
            return {
                success: true,
                data: {
                    credentials,
                    count: credentials.length,
                    ...(usageScanError ? { usageScanError } : {}),
                },
            };
        }
        const result = await client.listCredentials({ cursor, limit });
        const credentials = result.data.map(stripCredentialData);
        return {
            success: true,
            data: {
                credentials,
                count: credentials.length,
                nextCursor: result.nextCursor || undefined,
            },
        };
    }
    catch (error) {
        if (isCredentialReadUnsupported(error)) {
            return credentialReadUnsupportedResponse(error);
        }
        return handleCrudError(error);
    }
}
async function handleGetCredential(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { id, includeUsage } = getCredentialSchema.parse(args);
        let credential;
        try {
            credential = await client.getCredential(id);
        }
        catch (getError) {
            if (!isCredentialReadUnsupported(getError)) {
                throw getError;
            }
            const all = await client.listAllCredentials();
            credential = all.find((c) => c.id === id);
            if (!credential) {
                return { success: false, error: `Credential ${id} not found` };
            }
        }
        const { data: _sensitiveData, ...safeCred } = credential;
        let enriched = safeCred;
        let usageScanError;
        if (includeUsage) {
            try {
                const usageMap = await buildCredentialUsageMap(client);
                const usedIn = usageMap.get(id) ?? [];
                enriched = { ...safeCred, usedIn, usageCount: usedIn.length };
            }
            catch (scanError) {
                usageScanError = scanError instanceof Error ? scanError.message : String(scanError);
            }
        }
        return {
            success: true,
            data: usageScanError ? { ...enriched, usageScanError } : enriched,
        };
    }
    catch (error) {
        if (isCredentialReadUnsupported(error)) {
            return credentialReadUnsupportedResponse(error);
        }
        return handleCrudError(error);
    }
}
function applyCredentialDataShims(type, data) {
    if (!data || type !== 'oAuth2Api' || data.grantType !== 'clientCredentials') {
        return data;
    }
    const shimmed = { ...data };
    if ('useDynamicClientRegistration' in shimmed && !shimmed.useDynamicClientRegistration) {
        delete shimmed.useDynamicClientRegistration;
    }
    if (!('sendAdditionalBodyProperties' in shimmed)) {
        shimmed.sendAdditionalBodyProperties = false;
    }
    if (!('additionalBodyProperties' in shimmed)) {
        shimmed.additionalBodyProperties = '';
    }
    const dcrActive = shimmed.useDynamicClientRegistration === true;
    if (!dcrActive && !('serverUrl' in shimmed)) {
        shimmed.serverUrl = '';
    }
    return shimmed;
}
async function handleCreateCredential(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { name, type, data } = createCredentialSchema.parse(args);
        const shimmedData = applyCredentialDataShims(type, data);
        logger_1.logger.info(`Creating credential: name="${name}", type="${type}"`);
        const credential = await client.createCredential({ name, type, data: shimmedData });
        const { data: _sensitiveData, ...safeCred } = credential;
        return {
            success: true,
            data: safeCred,
            message: `Credential "${name}" (type: ${type}) created with ID ${credential.id}`,
        };
    }
    catch (error) {
        return handleCrudError(error);
    }
}
async function handleUpdateCredential(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { id, name, type, data } = updateCredentialSchema.parse(args);
        logger_1.logger.info(`Updating credential: id="${id}"${name ? `, name="${name}"` : ''}`);
        const updatePayload = {};
        if (name !== undefined)
            updatePayload.name = name;
        if (type !== undefined)
            updatePayload.type = type;
        if (data !== undefined) {
            let derivedType = type;
            if (derivedType === undefined && data?.grantType === 'clientCredentials') {
                try {
                    const existing = await client.getCredential(id);
                    derivedType = existing?.type;
                }
                catch {
                }
            }
            updatePayload.data = applyCredentialDataShims(derivedType ?? '', data);
        }
        const credential = await client.updateCredential(id, updatePayload);
        const { data: _sensitiveData, ...safeCred } = credential;
        return {
            success: true,
            data: safeCred,
            message: `Credential ${id} updated successfully`,
        };
    }
    catch (error) {
        return handleCrudError(error);
    }
}
async function handleDeleteCredential(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { id } = deleteCredentialSchema.parse(args);
        logger_1.logger.info(`Deleting credential: id="${id}"`);
        await client.deleteCredential(id);
        return {
            success: true,
            message: `Credential ${id} deleted successfully`,
        };
    }
    catch (error) {
        return handleCrudError(error);
    }
}
async function handleGetCredentialSchema(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const { type } = getCredentialSchemaTypeSchema.parse(args);
        const schema = await client.getCredentialSchema(type);
        return {
            success: true,
            data: schema,
            message: `Schema for credential type "${type}"`,
        };
    }
    catch (error) {
        return handleCrudError(error);
    }
}
const FOLDER_PROJECT_ROOT = '0';
const folderProjectSchema = zod_1.z.object({
    projectId: optionalEmptyAware(zod_1.z.string().trim().min(1)).transform((v) => v ?? 'personal'),
});
const folderIdSchema = folderProjectSchema.extend({
    folderId: zod_1.z.string().trim().min(1),
});
const nullOrEmptyToUndefined = (v) => (v === null ? undefined : emptyToUndefined(v));
const optionalParentFolderId = zod_1.z.preprocess(nullOrEmptyToUndefined, zod_1.z.string().trim().min(1).optional());
const createFolderSchema = folderProjectSchema.extend({
    name: zod_1.z.string().trim().min(1),
    parentFolderId: optionalParentFolderId,
});
const listFoldersSchema = folderProjectSchema.extend({
    nameFilter: optionalEmptyAware(zod_1.z.string().trim().min(1)),
    parentFolderId: optionalParentFolderId,
    sortBy: zod_1.z.enum(['name:asc', 'name:desc', 'createdAt:asc', 'createdAt:desc', 'updatedAt:asc', 'updatedAt:desc']).optional(),
    skip: zod_1.z.number().int().min(0).optional(),
    take: zod_1.z.number().int().min(1).max(100).optional(),
});
const renameFolderSchema = folderIdSchema.extend({
    name: zod_1.z.string().trim().min(1),
});
const moveFolderSchema = folderIdSchema.extend({
    parentFolderId: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().min(1).nullable()),
});
const deleteFolderSchema = folderIdSchema.extend({
    transferToFolderId: optionalEmptyAware(zod_1.z.string().trim().min(1)),
});
function handleFolderError(error) {
    const response = handleCrudError(error);
    if (error instanceof n8n_errors_1.N8nApiError) {
        const appendHint = (hint) => {
            const base = (response.error ?? '').trimEnd();
            response.error = `${base}${/[.!?]$/.test(base) ? '' : '.'} ${hint}`;
        };
        if (error.statusCode === 403) {
            appendHint('Folders need an API key with folder:* scopes AND a licensed instance: folders unlock on the registered free Community tier (Settings -> Usage and plan -> register) and up.');
        }
        else if (error.statusCode === 404) {
            appendHint('Check the projectId and folderId; on n8n older than 2.19 the folders API does not exist at all.');
        }
    }
    return response;
}
async function resolveFolderProjectId(client, projectId) {
    return projectId === 'personal' ? await client.resolvePersonalProjectId() : projectId;
}
const FOLDER_LIST_SELECT = ['id', 'name', 'createdAt', 'updatedAt', 'parentFolder', 'workflowCount', 'subFolderCount', 'path'];
async function handleCreateFolder(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = createFolderSchema.parse(args);
        const folder = await client.createFolder(input.projectId, {
            name: input.name,
            ...(input.parentFolderId ? { parentFolderId: input.parentFolderId } : {}),
        });
        if (!folder || !folder.id) {
            return { success: false, error: 'Folder creation failed: n8n API returned an empty or invalid response' };
        }
        return {
            success: true,
            data: { id: folder.id, name: folder.name, parentFolderId: folder.parentFolderId ?? null },
            message: `Folder "${folder.name}" created with ID: ${folder.id}. Place workflows in it via n8n_create_workflow's parentFolderId or the moveToFolder operation of n8n_update_partial_workflow.`,
        };
    }
    catch (error) {
        return handleFolderError(error);
    }
}
async function handleListFolders(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = listFoldersSchema.parse(args || {});
        const projectId = await resolveFolderProjectId(client, input.projectId);
        const filter = {};
        if (input.nameFilter)
            filter.name = input.nameFilter;
        if (input.parentFolderId)
            filter.parentFolderId = input.parentFolderId;
        const result = await client.listFolders(projectId, {
            ...(Object.keys(filter).length > 0 ? { filter } : {}),
            select: FOLDER_LIST_SELECT,
            sortBy: input.sortBy ?? 'updatedAt:desc',
            skip: input.skip ?? 0,
            take: input.take ?? 50,
        });
        return {
            success: true,
            data: {
                folders: result.data,
                count: result.count,
                projectId,
            },
        };
    }
    catch (error) {
        return handleFolderError(error);
    }
}
async function handleGetFolder(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = folderIdSchema.parse(args);
        const projectId = await resolveFolderProjectId(client, input.projectId);
        const folder = await client.getFolder(projectId, input.folderId);
        return { success: true, data: { ...folder, projectId } };
    }
    catch (error) {
        return handleFolderError(error);
    }
}
async function handleRenameFolder(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = renameFolderSchema.parse(args);
        const projectId = await resolveFolderProjectId(client, input.projectId);
        const folder = await client.updateFolder(projectId, input.folderId, { name: input.name });
        return {
            success: true,
            data: { id: folder.id, name: folder.name },
            message: `Folder renamed to "${folder.name}"`,
        };
    }
    catch (error) {
        return handleFolderError(error);
    }
}
async function handleMoveFolder(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = moveFolderSchema.parse(args);
        const projectId = await resolveFolderProjectId(client, input.projectId);
        const target = input.parentFolderId ?? FOLDER_PROJECT_ROOT;
        const folder = await client.updateFolder(projectId, input.folderId, { parentFolderId: target });
        return {
            success: true,
            data: { id: folder.id, name: folder.name, parentFolderId: folder.parentFolderId ?? null },
            message: target === FOLDER_PROJECT_ROOT
                ? `Folder "${folder.name}" moved to the project root`
                : `Folder "${folder.name}" moved under folder ${target}`,
        };
    }
    catch (error) {
        return handleFolderError(error);
    }
}
async function handleDeleteFolder(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = deleteFolderSchema.parse(args);
        const projectId = await resolveFolderProjectId(client, input.projectId);
        await client.deleteFolder(projectId, input.folderId, input.transferToFolderId);
        return {
            success: true,
            data: { id: input.folderId, deleted: true },
            message: input.transferToFolderId
                ? `Folder ${input.folderId} deleted; contents transferred to ${input.transferToFolderId === FOLDER_PROJECT_ROOT ? 'the project root' : `folder ${input.transferToFolderId}`}`
                : `Folder ${input.folderId} deleted; its workflows were moved to the project root and ARCHIVED, sub-folders were deleted`,
        };
    }
    catch (error) {
        return handleFolderError(error);
    }
}
const auditInstanceSchema = zod_1.z.object({
    categories: zod_1.z.array(zod_1.z.enum([
        'credentials', 'database', 'nodes', 'instance', 'filesystem',
    ])).optional(),
    includeCustomScan: zod_1.z.boolean().optional().default(true),
    daysAbandonedWorkflow: zod_1.z.number().optional(),
    customChecks: zod_1.z.array(zod_1.z.enum([
        'hardcoded_secrets', 'unauthenticated_webhooks', 'error_handling', 'data_retention',
    ])).optional(),
});
async function handleAuditInstance(args, context) {
    try {
        const client = ensureApiConfigured(context);
        const input = auditInstanceSchema.parse(args);
        const totalStart = Date.now();
        const warnings = [];
        let builtinAudit = null;
        let builtinAuditMs = 0;
        const auditStart = Date.now();
        try {
            builtinAudit = await client.generateAudit({
                categories: input.categories,
                daysAbandonedWorkflow: input.daysAbandonedWorkflow,
            });
            builtinAuditMs = Date.now() - auditStart;
        }
        catch (auditError) {
            builtinAuditMs = Date.now() - auditStart;
            const status = auditError?.statusCode;
            const reason = auditError?.message || 'unknown error';
            let msg;
            if (status === 404) {
                msg = 'Built-in audit endpoint not available on this n8n version.';
            }
            else if (status !== undefined) {
                msg = `Built-in audit failed (HTTP ${status}): ${reason}`;
            }
            else {
                msg = `Built-in audit failed (no response from n8n): ${reason}`;
            }
            warnings.push(msg);
            logger_1.logger.warn(`Audit: ${msg}`);
        }
        let customReport = null;
        let workflowFetchMs = 0;
        let customScanMs = 0;
        if (input.includeCustomScan) {
            try {
                const fetchStart = Date.now();
                const allWorkflows = await client.listAllWorkflows();
                workflowFetchMs = Date.now() - fetchStart;
                logger_1.logger.info(`Audit: fetched ${allWorkflows.length} workflows for scanning`);
                const scanStart = Date.now();
                customReport = (0, workflow_security_scanner_1.scanWorkflows)(allWorkflows, input.customChecks);
                customScanMs = Date.now() - scanStart;
                logger_1.logger.info(`Audit: custom scan found ${customReport.summary.total} findings across ${customReport.workflowsScanned} workflows`);
            }
            catch (scanError) {
                warnings.push(`Custom scan failed: ${scanError?.message || 'unknown error'}`);
                logger_1.logger.warn(`Audit: custom scan failed: ${scanError?.message}`);
            }
        }
        const totalMs = Date.now() - totalStart;
        const apiConfig = resolveN8nApiConfigForResponse(context);
        const instanceUrl = apiConfig?.baseUrl || 'unknown';
        const report = (0, audit_report_builder_1.buildAuditReport)({
            builtinAudit,
            customReport,
            performance: { builtinAuditMs, workflowFetchMs, customScanMs, totalMs },
            instanceUrl,
            warnings: warnings.length > 0 ? warnings : undefined,
        });
        return {
            success: true,
            data: {
                report: report.markdown,
                summary: report.summary,
            },
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                success: false,
                error: 'Invalid audit parameters',
                details: { issues: error.errors },
            };
        }
        if (error instanceof n8n_errors_1.N8nApiError) {
            return {
                success: false,
                error: (0, n8n_errors_1.getUserFriendlyErrorMessage)(error),
            };
        }
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
    }
}
//# sourceMappingURL=handlers-n8n-manager.js.map