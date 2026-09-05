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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.N8nApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const n8n_errors_1 = require("../utils/n8n-errors");
const validation_schemas_1 = require("../utils/validation-schemas");
const n8n_validation_1 = require("./n8n-validation");
const node_groups_1 = require("./node-groups");
const n8n_version_1 = require("./n8n-version");
const GROUPS_UNSUPPORTED_WARNING = 'This n8n version does not support canvas groups (added in 2.28); the workflow was saved without them.';
const GROUP_DESCRIPTIONS_UNSUPPORTED_WARNING = 'This n8n version does not support canvas group descriptions (added in 2.32); the descriptions were not saved.';
const settingsRejectedWarning = (keys) => `This n8n version rejects the workflow settings ${keys.join(', ')}; they were left out of the write ` +
    '(on an update, the values the instance already stores are unchanged). Upgrade n8n to set them.';
const ROUTE_ABSENT_STATUSES = new Set([404, 405, 410]);
function failureStatus(error) {
    if (error instanceof n8n_errors_1.N8nApiError)
        return error.statusCode;
    return error?.response?.status;
}
function hasDeprecationHeader(headers) {
    if (!headers || typeof headers !== 'object')
        return false;
    return Object.entries(headers).some(([name, value]) => name.toLowerCase() === 'deprecation' && value !== undefined && value !== '');
}
function withoutNodeGroups(payload) {
    const { nodeGroups, ...rest } = payload;
    return rest;
}
function withoutSettings(payload, keys) {
    const drop = new Set(keys);
    const settings = payload.settings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings))
        return payload;
    const kept = Object.fromEntries(Object.entries(settings).filter(([key]) => !drop.has(key)));
    if (Object.keys(kept).length === Object.keys(settings).length)
        return payload;
    return { ...payload, settings: Object.keys(kept).length > 0 ? kept : { executionOrder: 'v1' } };
}
class N8nApiClient {
    constructor(config) {
        this.versionInfo = null;
        this.versionPromise = null;
        this.personalProjectId = null;
        this.pinnedAgentsPromise = null;
        this.pinnedAgentsResolvedAt = 0;
        this.groupSupport = { groups: true, descriptions: true };
        this.rejectedSettings = new Set();
        this.modernPublishRoute = false;
        const { baseUrl, apiKey, timeout = 30000, maxRetries = 3, cfClientId, cfClientSecret } = config;
        this.maxRetries = maxRetries;
        this.cfClientId = cfClientId;
        this.cfClientSecret = cfClientSecret;
        let normalizedBase;
        try {
            const parsed = new URL(baseUrl);
            parsed.hash = '';
            parsed.username = '';
            parsed.password = '';
            normalizedBase = parsed.toString().replace(/\/$/, '');
        }
        catch {
            normalizedBase = baseUrl;
        }
        this.baseUrl = normalizedBase;
        const apiUrl = normalizedBase.endsWith('/api/v1')
            ? normalizedBase
            : `${normalizedBase}/api/v1`;
        const headers = {
            'X-N8N-API-KEY': apiKey,
            'Content-Type': 'application/json',
            ...this.cfAccessHeaders(),
        };
        this.client = axios_1.default.create({
            baseURL: apiUrl,
            timeout,
            headers,
            maxRedirects: 0,
        });
        this.client.interceptors.request.use(async (config) => {
            const agents = await this.getPinnedAgents();
            config.httpAgent = agents.httpAgent;
            config.httpsAgent = agents.httpsAgent;
            const isSensitive = config.url?.includes('/credentials') && config.method !== 'get';
            logger_1.logger.debug(`n8n API Request: ${config.method?.toUpperCase()} ${config.url}`, {
                params: config.params,
                data: isSensitive ? '[REDACTED]' : config.data,
            });
            return config;
        }, (error) => {
            logger_1.logger.error('n8n API Request Error:', error);
            return Promise.reject(error);
        });
        this.client.interceptors.response.use((response) => {
            logger_1.logger.debug(`n8n API Response: ${response.status} ${response.config.url}`);
            return response;
        }, async (error) => {
            const retryAttempt = this.tryRetry(error);
            if (retryAttempt) {
                return retryAttempt;
            }
            const n8nError = (0, n8n_errors_1.handleN8nApiError)(error);
            if (n8nError.code === 'NO_RESPONSE') {
                this.pinnedAgentsPromise = null;
            }
            (0, n8n_errors_1.logN8nError)(n8nError, 'n8n API Response');
            return Promise.reject(n8nError);
        });
    }
    tryRetry(error) {
        const axiosError = error;
        const config = axiosError?.config;
        const noResponse = !!(axiosError && axiosError.request && !axiosError.response);
        if (!noResponse || !config) {
            return undefined;
        }
        const retryCount = config.__retryCount || 0;
        if (retryCount >= this.maxRetries) {
            return undefined;
        }
        const method = String(config.method || '');
        if (!this.isRetryableConnectionError(axiosError, method)) {
            return undefined;
        }
        config.__retryCount = retryCount + 1;
        this.pinnedAgentsPromise = null;
        const backoffMs = 250 * Math.pow(2, retryCount);
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                this.client.request(config).then(resolve, reject);
            }, backoffMs);
        });
    }
    isRetryableConnectionError(axiosError, method) {
        const codes = this.extractErrorCodes(axiosError);
        if (codes.length === 0)
            return false;
        const isIdempotent = method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD';
        const anyMethodCodes = new Set(['ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN']);
        const idempotentOnlyCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED']);
        return codes.some(code => anyMethodCodes.has(code) || (isIdempotent && idempotentOnlyCodes.has(code)));
    }
    extractErrorCodes(error) {
        const codes = [];
        if (error?.code)
            codes.push(error.code);
        const aggregateMembers = error?.errors ?? error?.cause?.errors;
        if (Array.isArray(aggregateMembers)) {
            for (const member of aggregateMembers) {
                if (member?.code)
                    codes.push(member.code);
            }
        }
        return codes;
    }
    getPinnedAgents() {
        const isExpired = this.pinnedAgentsPromise !== null &&
            Date.now() - this.pinnedAgentsResolvedAt > N8nApiClient.PINNED_AGENTS_TTL_MS;
        if (isExpired) {
            this.pinnedAgentsPromise = null;
        }
        if (!this.pinnedAgentsPromise) {
            const promise = (async () => {
                const { SSRFProtection } = await Promise.resolve().then(() => __importStar(require('../utils/ssrf-protection')));
                const validation = await SSRFProtection.validateWebhookUrl(this.baseUrl);
                if (!validation.valid || !validation.address || !validation.family) {
                    throw new Error(`SSRF protection: ${validation.reason || 'baseUrl rejected'}`);
                }
                return SSRFProtection.createPinnedAgents(validation.addresses ?? [{ address: validation.address, family: validation.family }]);
            })();
            this.pinnedAgentsResolvedAt = Date.now();
            promise.then(() => {
                if (this.pinnedAgentsPromise === promise) {
                    this.pinnedAgentsResolvedAt = Date.now();
                }
            }, () => { });
            promise.catch(() => {
                if (this.pinnedAgentsPromise === promise) {
                    this.pinnedAgentsPromise = null;
                }
            });
            this.pinnedAgentsPromise = promise;
        }
        return this.pinnedAgentsPromise;
    }
    async getVersion() {
        if (this.versionInfo) {
            return this.versionInfo;
        }
        if (this.versionPromise) {
            return this.versionPromise;
        }
        this.versionPromise = this.fetchVersionOnce();
        try {
            this.versionInfo = await this.versionPromise;
            return this.versionInfo;
        }
        finally {
            this.versionPromise = null;
        }
    }
    cfAccessHeaders() {
        const headers = {};
        if (this.cfClientId)
            headers['CF-Access-Client-Id'] = this.cfClientId;
        if (this.cfClientSecret)
            headers['CF-Access-Client-Secret'] = this.cfClientSecret;
        return headers;
    }
    cfAccessHeadersOrUndefined() {
        const headers = this.cfAccessHeaders();
        return Object.keys(headers).length > 0 ? headers : undefined;
    }
    isSameOrigin(targetUrl) {
        try {
            return new URL(targetUrl).origin === new URL(this.baseUrl).origin;
        }
        catch {
            return false;
        }
    }
    async fetchVersionOnce() {
        const cached = (0, n8n_version_1.getCachedVersion)(this.baseUrl);
        if (cached)
            return cached;
        const agents = await this.getPinnedAgents();
        return await (0, n8n_version_1.fetchN8nVersion)(this.baseUrl, {
            headers: this.cfAccessHeadersOrUndefined(),
            pinnedAgents: agents,
        });
    }
    getCachedVersionInfo() {
        return this.versionInfo;
    }
    async refreshVersion() {
        const agents = await this.getPinnedAgents();
        const version = await (0, n8n_version_1.fetchN8nVersion)(this.baseUrl, {
            headers: this.cfAccessHeadersOrUndefined(),
            pinnedAgents: agents,
            forceRefresh: true,
        });
        if (version) {
            this.versionInfo = version;
        }
        return version;
    }
    async healthCheck() {
        try {
            const baseUrl = this.client.defaults.baseURL || '';
            const healthzUrl = baseUrl.replace(/\/api\/v\d+\/?$/, '') + '/healthz';
            const agents = await this.getPinnedAgents();
            const response = await axios_1.default.get(healthzUrl, {
                timeout: 5000,
                headers: this.cfAccessHeadersOrUndefined(),
                validateStatus: (status) => status < 500,
                maxRedirects: 0,
                httpAgent: agents.httpAgent,
                httpsAgent: agents.httpsAgent,
            });
            const versionInfo = await this.getVersion();
            if (response.status === 200 && response.data?.status === 'ok') {
                return {
                    status: 'ok',
                    n8nVersion: versionInfo?.version,
                    features: {}
                };
            }
            throw new Error('healthz endpoint not available');
        }
        catch (error) {
            try {
                await this.client.get('/workflows', { params: { limit: 1 } });
                const versionInfo = await this.getVersion();
                return {
                    status: 'ok',
                    n8nVersion: versionInfo?.version,
                    features: {}
                };
            }
            catch (fallbackError) {
                throw (0, n8n_errors_1.handleN8nApiError)(fallbackError);
            }
        }
    }
    async sendWorkflowWrite(payload, send, options) {
        const sentBodies = new WeakMap();
        const trackedSend = async (body) => {
            try {
                return await send(body);
            }
            catch (error) {
                const apiError = (0, n8n_errors_1.handleN8nApiError)(error);
                sentBodies.set(apiError, body);
                throw apiError;
            }
        };
        try {
            return await this.sendWorkflowWriteWithSettingsFallback(payload, trackedSend, options);
        }
        catch (error) {
            const apiError = (0, n8n_errors_1.handleN8nApiError)(error);
            const enriched = (0, n8n_errors_1.enrichUnknownPropertyError)(apiError, sentBodies.get(apiError) ?? payload);
            if (enriched !== apiError) {
                logger_1.logger.warn('n8n rejected a workflow write with an unnamed additional property', {
                    message: enriched.message
                });
            }
            throw enriched;
        }
    }
    async sendWorkflowWriteWithSettingsFallback(payload, send, options) {
        const settings = payload.settings;
        const remembered = settings
            ? [...this.rejectedSettings].filter(key => Object.prototype.hasOwnProperty.call(settings, key))
            : [];
        let body = withoutSettings(payload, remembered);
        if (remembered.length > 0)
            options.onWarning?.(settingsRejectedWarning(remembered));
        const steps = (0, n8n_version_1.settingsRejectionLadder)(body.settings);
        const dropped = [];
        const namedByN8n = [];
        let lastGuess = [];
        const settingsKeys = () => Object.keys(body.settings ?? {});
        const maxSettingsRetries = steps.length + settingsKeys().length;
        for (let step = 0, retries = 0;;) {
            try {
                const result = await this.sendWorkflowWriteWithGroupFallback(body, send, options);
                if (dropped.length > 0) {
                    const certain = lastGuess.length === 1 ? [...namedByN8n, ...lastGuess] : namedByN8n;
                    for (const key of certain)
                        this.rejectedSettings.add(key);
                    options.onWarning?.(settingsRejectedWarning(dropped));
                }
                return result;
            }
            catch (error) {
                const apiError = (0, n8n_errors_1.handleN8nApiError)(error);
                if (!(0, n8n_errors_1.isUnknownSettingsPropertyError)(apiError) || retries++ >= maxSettingsRetries)
                    throw apiError;
                const present = new Set(settingsKeys());
                const named = (0, n8n_errors_1.unknownSettingsKeysNamedBy)(apiError).filter(key => present.has(key));
                let drop = named;
                while (drop.length === 0 && step < steps.length) {
                    drop = steps[step++].filter(key => present.has(key));
                }
                if (drop.length === 0)
                    throw apiError;
                if (named.length > 0) {
                    namedByN8n.push(...named);
                    lastGuess = [];
                }
                else {
                    lastGuess = drop;
                }
                body = withoutSettings(body, drop);
                dropped.push(...drop);
            }
        }
    }
    async sendWorkflowWriteWithGroupFallback(payload, send, options) {
        if (!Array.isArray(payload.nodeGroups)) {
            return await send(payload);
        }
        if (!this.groupSupport.groups) {
            options.onWarning?.(GROUPS_UNSUPPORTED_WARNING);
            return await send(withoutNodeGroups(payload));
        }
        let groups = (0, node_groups_1.sanitizeGroupsForApi)(payload.nodeGroups, {
            includeDescription: this.groupSupport.descriptions,
        });
        if (!this.groupSupport.descriptions &&
            payload.nodeGroups.some(group => group?.description !== undefined)) {
            options.onWarning?.(GROUP_DESCRIPTIONS_UNSUPPORTED_WARNING);
        }
        const maxAttempts = groups.length + 3;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await send({ ...payload, nodeGroups: groups });
            }
            catch (error) {
                const apiError = (0, n8n_errors_1.handleN8nApiError)(error);
                const next = this.degradeGroupsAfterRejection((0, node_groups_1.classifyGroupError)(apiError), groups, options);
                if (next === 'give-up')
                    throw apiError;
                if (next === 'omit-field') {
                    let result;
                    try {
                        result = await send(withoutNodeGroups(payload));
                    }
                    catch (retryError) {
                        const second = (0, n8n_errors_1.handleN8nApiError)(retryError);
                        throw (0, n8n_errors_1.isUnknownSettingsPropertyError)(second) ? second : apiError;
                    }
                    this.groupSupport.groups = false;
                    options.onWarning?.(GROUPS_UNSUPPORTED_WARNING);
                    return result;
                }
                groups = next;
            }
        }
        throw new Error('Could not save workflow: n8n kept rejecting its canvas groups');
    }
    degradeGroupsAfterRejection(classification, groups, options) {
        const warn = (message) => options.onWarning?.(message);
        const authored = options.authoredGroups ?? new Set();
        if (classification.kind === 'schema-description' && this.groupSupport.descriptions) {
            this.groupSupport.descriptions = false;
            warn(GROUP_DESCRIPTIONS_UNSUPPORTED_WARNING);
            return (0, node_groups_1.sanitizeGroupsForApi)(groups, { includeDescription: false });
        }
        if (classification.kind === 'schema-field')
            return 'omit-field';
        if (classification.kind !== 'semantic')
            return 'give-up';
        const { groupName, groupId } = classification;
        if (groupName || groupId) {
            const { groups: remaining, dropped } = (0, node_groups_1.dropRejectedGroup)(groups, { groupId, groupName });
            if (dropped && authored.has(dropped.name))
                return 'give-up';
            if (dropped) {
                warn(`n8n rejected node group "${dropped.name}", so it was ungrouped to save the workflow (nodes and connections are unchanged). n8n said: ${classification.message}`);
                return remaining;
            }
            return 'give-up';
        }
        const keepAuthored = groups.filter(group => authored.has(group.name));
        if (keepAuthored.length < groups.length) {
            warn(`n8n rejected the canvas groups on this workflow, so ${keepAuthored.length > 0 ? 'the ones it did not ask about were' : 'all of them were'} removed to save it (nodes and connections are unchanged). n8n said: ${classification.message}`);
            return keepAuthored;
        }
        return 'give-up';
    }
    async putOrPatchWorkflow(safeId, body) {
        try {
            const response = await this.client.put(`/workflows/${safeId}`, body);
            return response.data;
        }
        catch (putError) {
            if (failureStatus(putError) !== 405)
                throw putError;
            logger_1.logger.debug('PUT method not supported, falling back to PATCH');
            const response = await this.client.patch(`/workflows/${safeId}`, body);
            return response.data;
        }
    }
    repairGroupsForWrite(payload, options) {
        if (!Array.isArray(payload.nodeGroups) || !Array.isArray(payload.nodes))
            return payload;
        const { nodeGroups, issues, errors } = (0, node_groups_1.repairNodeGroups)({
            nodes: payload.nodes,
            nodeGroups: payload.nodeGroups,
        }, { authoredGroups: options.authoredGroups });
        if (errors && errors.length > 0) {
            throw new n8n_errors_1.N8nValidationError(errors.join(' '), { nodeGroups: errors });
        }
        for (const issue of issues) {
            options.onWarning?.(issue.message);
        }
        return nodeGroups === payload.nodeGroups ? payload : { ...payload, nodeGroups };
    }
    async createWorkflow(workflow, options = {}) {
        try {
            const cleanedWorkflow = (0, n8n_validation_1.cleanWorkflowForCreate)(workflow);
            const payload = this.repairGroupsForWrite(cleanedWorkflow, options);
            return await this.sendWorkflowWrite(payload, async (body) => (await this.client.post('/workflows', body)).data, options);
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async getWorkflow(id) {
        try {
            const response = await this.client.get(`/workflows/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'workflowId')}`);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async updateWorkflow(id, workflow, options = {}) {
        try {
            const cleanedWorkflow = (0, n8n_validation_1.cleanWorkflowForUpdate)(workflow);
            const versionInfo = await this.getVersion();
            if (versionInfo) {
                logger_1.logger.debug(`Updating workflow with n8n version ${versionInfo.version}`);
                cleanedWorkflow.settings = (0, n8n_version_1.cleanSettingsForVersion)(cleanedWorkflow.settings, versionInfo);
            }
            else {
                logger_1.logger.debug('n8n version unknown, forwarding workflow settings unfiltered');
            }
            const safeId = (0, validation_schemas_1.encodeApiPathSegment)(id, 'workflowId');
            const payload = this.repairGroupsForWrite(cleanedWorkflow, options);
            return await this.sendWorkflowWrite(payload, body => this.putOrPatchWorkflow(safeId, body), options);
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async deleteWorkflow(id) {
        try {
            const response = await this.client.delete(`/workflows/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'workflowId')}`);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async transferWorkflow(id, destinationProjectId) {
        try {
            await this.client.put(`/workflows/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'workflowId')}/transfer`, { destinationProjectId });
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async postPublishRoute(id, modernPath, legacyPath) {
        const safeId = (0, validation_schemas_1.encodeApiPathSegment)(id, 'workflowId');
        let preferModern = this.modernPublishRoute;
        if (!preferModern) {
            const version = await this.getVersion();
            preferModern = version !== null && (0, n8n_version_1.versionAtLeast)(version, 2, 33, 0);
        }
        const [primaryPath, fallbackPath] = preferModern
            ? [modernPath, legacyPath]
            : [legacyPath, modernPath];
        const post = async (path) => {
            const response = await this.client.post(`/workflows/${safeId}/${path}`, {});
            if (path === legacyPath && hasDeprecationHeader(response.headers)) {
                this.confirmModernPublishRoute(`/${legacyPath} answered with a Deprecation header`);
            }
            return response.data;
        };
        let status;
        let primaryError;
        try {
            return await post(primaryPath);
        }
        catch (error) {
            status = failureStatus(error);
            if (!ROUTE_ABSENT_STATUSES.has(status)) {
                throw (0, n8n_errors_1.handleN8nApiError)(error);
            }
            primaryError = error;
        }
        logger_1.logger.debug(`POST /workflows/{id}/${primaryPath} returned ${status} - retrying /${fallbackPath} ` +
            '(this n8n does not serve that route, or the workflow does not exist)');
        try {
            const workflow = await post(fallbackPath);
            if (fallbackPath === modernPath) {
                this.confirmModernPublishRoute(`/${legacyPath} is absent and /${modernPath} answered`);
            }
            return workflow;
        }
        catch (fallbackError) {
            const fallbackStatus = failureStatus(fallbackError);
            throw (0, n8n_errors_1.handleN8nApiError)(ROUTE_ABSENT_STATUSES.has(fallbackStatus) ? primaryError : fallbackError);
        }
    }
    confirmModernPublishRoute(evidence) {
        if (this.modernPublishRoute)
            return;
        this.modernPublishRoute = true;
        logger_1.logger.debug(`Using the publish/unpublish routes for this instance: ${evidence}`);
    }
    async activateWorkflow(id) {
        return this.postPublishRoute(id, 'publish', 'activate');
    }
    async deactivateWorkflow(id) {
        return this.postPublishRoute(id, 'unpublish', 'deactivate');
    }
    async listWorkflows(params = {}) {
        try {
            const response = await this.client.get('/workflows', { params });
            return this.validateListResponse(response.data, 'workflows');
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async generateAudit(options) {
        try {
            const additionalOptions = {};
            if (options?.categories)
                additionalOptions.categories = options.categories;
            if (options?.daysAbandonedWorkflow !== undefined)
                additionalOptions.daysAbandonedWorkflow = options.daysAbandonedWorkflow;
            const body = Object.keys(additionalOptions).length > 0 ? { additionalOptions } : {};
            const response = await this.client.post('/audit', body);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async listAllWorkflows() {
        const allWorkflows = [];
        let cursor;
        const seenCursors = new Set();
        const PAGE_SIZE = 100;
        const MAX_PAGES = 50;
        for (let page = 0; page < MAX_PAGES; page++) {
            const params = { limit: PAGE_SIZE, cursor };
            const response = await this.listWorkflows(params);
            allWorkflows.push(...response.data);
            if (!response.nextCursor || seenCursors.has(response.nextCursor))
                break;
            seenCursors.add(response.nextCursor);
            cursor = response.nextCursor;
        }
        return allWorkflows;
    }
    async getExecution(id, includeData = false) {
        try {
            const response = await this.client.get(`/executions/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'executionId')}`, {
                params: { includeData },
            });
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async listExecutions(params = {}) {
        try {
            const response = await this.client.get('/executions', { params });
            return this.validateListResponse(response.data, 'executions');
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async deleteExecution(id) {
        try {
            await this.client.delete(`/executions/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'executionId')}`);
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async listTestRuns(workflowId, params = {}) {
        try {
            const response = await this.client.get(`/workflows/${(0, validation_schemas_1.encodeApiPathSegment)(workflowId, 'workflowId')}/test-runs`, { params });
            return this.validateListResponse(response.data, 'test runs');
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async getTestRun(workflowId, runId) {
        try {
            const response = await this.client.get(`/workflows/${(0, validation_schemas_1.encodeApiPathSegment)(workflowId, 'workflowId')}/test-runs/${(0, validation_schemas_1.encodeApiPathSegment)(runId, 'runId')}`);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async listTestCases(workflowId, runId, params = {}) {
        try {
            const response = await this.client.get(`/workflows/${(0, validation_schemas_1.encodeApiPathSegment)(workflowId, 'workflowId')}/test-runs/${(0, validation_schemas_1.encodeApiPathSegment)(runId, 'runId')}/test-cases`, { params });
            return this.validateListResponse(response.data, 'test cases');
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async triggerTestRun(workflowId) {
        try {
            const response = await this.client.post(`/workflows/${(0, validation_schemas_1.encodeApiPathSegment)(workflowId, 'workflowId')}/test-runs`, {});
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async cancelTestRun(workflowId, runId) {
        try {
            const response = await this.client.post(`/workflows/${(0, validation_schemas_1.encodeApiPathSegment)(workflowId, 'workflowId')}/test-runs/${(0, validation_schemas_1.encodeApiPathSegment)(runId, 'runId')}/cancel`, {});
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async triggerWebhook(request) {
        try {
            const { webhookUrl, httpMethod, data, headers, waitForResponse = true } = request;
            const { SSRFProtection } = await Promise.resolve().then(() => __importStar(require('../utils/ssrf-protection')));
            const validation = await SSRFProtection.validateWebhookUrl(webhookUrl);
            if (!validation.valid) {
                throw new Error(`SSRF protection: ${validation.reason}`);
            }
            const url = new URL(webhookUrl);
            const webhookPath = url.pathname;
            const forwardCfHeaders = this.isSameOrigin(webhookUrl);
            if (!forwardCfHeaders && Object.keys(this.cfAccessHeaders()).length > 0) {
                logger_1.logger.debug('Withholding Cloudflare Access headers: webhook host differs from the configured n8n instance origin');
            }
            const config = {
                method: httpMethod,
                url: webhookPath,
                headers: {
                    ...headers,
                    ...(forwardCfHeaders ? this.cfAccessHeaders() : {}),
                    'X-N8N-API-KEY': undefined,
                },
                data: httpMethod !== 'GET' ? data : undefined,
                params: httpMethod === 'GET' ? data : undefined,
                timeout: waitForResponse ? 120000 : 30000,
            };
            const pinned = validation.address && validation.family
                ? SSRFProtection.createPinnedAgents(validation.addresses ?? [{ address: validation.address, family: validation.family }])
                : undefined;
            const webhookClient = axios_1.default.create({
                baseURL: new URL('/', webhookUrl).toString(),
                validateStatus: (status) => status < 500,
                maxRedirects: 0,
                httpAgent: pinned?.httpAgent,
                httpsAgent: pinned?.httpsAgent,
            });
            const response = await webhookClient.request(config);
            return {
                status: response.status,
                statusText: response.statusText,
                data: response.data,
                headers: response.headers,
            };
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async listCredentials(params = {}) {
        try {
            const response = await this.client.get('/credentials', { params });
            return this.validateListResponse(response.data, 'credentials');
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async listAllCredentials() {
        const allCredentials = [];
        let cursor;
        const seenCursors = new Set();
        const PAGE_SIZE = 100;
        const MAX_PAGES = 50;
        for (let page = 0; page < MAX_PAGES; page++) {
            const params = { limit: PAGE_SIZE, cursor };
            const response = await this.listCredentials(params);
            allCredentials.push(...response.data);
            if (!response.nextCursor || seenCursors.has(response.nextCursor))
                break;
            seenCursors.add(response.nextCursor);
            cursor = response.nextCursor;
        }
        return allCredentials;
    }
    async getCredential(id) {
        try {
            const response = await this.client.get(`/credentials/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'credentialId')}`);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async createCredential(credential) {
        try {
            const response = await this.client.post('/credentials', credential);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async updateCredential(id, credential) {
        try {
            const response = await this.client.patch(`/credentials/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'credentialId')}`, credential);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async deleteCredential(id) {
        try {
            await this.client.delete(`/credentials/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'credentialId')}`);
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async getCredentialSchema(typeName) {
        try {
            const response = await this.client.get(`/credentials/schema/${(0, validation_schemas_1.encodeApiPathSegment)(typeName, 'credentialTypeName')}`);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async listTags(params = {}) {
        try {
            const response = await this.client.get('/tags', { params });
            return this.validateListResponse(response.data, 'tags');
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async createTag(tag) {
        try {
            const response = await this.client.post('/tags', tag);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async updateTag(id, tag) {
        try {
            const response = await this.client.patch(`/tags/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'tagId')}`, tag);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async deleteTag(id) {
        try {
            await this.client.delete(`/tags/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'tagId')}`);
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async updateWorkflowTags(workflowId, tagIds) {
        try {
            const response = await this.client.put(`/workflows/${(0, validation_schemas_1.encodeApiPathSegment)(workflowId, 'workflowId')}/tags`, tagIds.filter(id => id).map(id => ({ id })));
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async getSourceControlStatus() {
        try {
            const response = await this.client.get('/source-control/status');
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async pullSourceControl(force = false) {
        try {
            const response = await this.client.post('/source-control/pull', { force });
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async pushSourceControl(message, fileNames) {
        try {
            const response = await this.client.post('/source-control/push', {
                message,
                fileNames,
            });
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async getVariables() {
        try {
            const response = await this.client.get('/variables');
            return response.data.data || [];
        }
        catch (error) {
            logger_1.logger.warn('Variables API not available, returning empty array');
            return [];
        }
    }
    async createVariable(variable) {
        try {
            const response = await this.client.post('/variables', variable);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async updateVariable(id, variable) {
        try {
            const response = await this.client.patch(`/variables/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'variableId')}`, variable);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async deleteVariable(id) {
        try {
            await this.client.delete(`/variables/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'variableId')}`);
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async createDataTable(params) {
        try {
            const response = await this.client.post('/data-tables', params);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async listDataTables(params = {}) {
        try {
            const response = await this.client.get('/data-tables', { params });
            return this.validateListResponse(response.data, 'data-tables');
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async getDataTable(id) {
        try {
            const response = await this.client.get(`/data-tables/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'dataTableId')}`);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async updateDataTable(id, params) {
        try {
            const response = await this.client.patch(`/data-tables/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'dataTableId')}`, params);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async deleteDataTable(id) {
        try {
            await this.client.delete(`/data-tables/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'dataTableId')}`);
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async getDataTableRows(id, params = {}) {
        try {
            const response = await this.client.get(`/data-tables/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'dataTableId')}/rows`, {
                params,
                paramsSerializer: (p) => this.serializeQueryParams(p),
            });
            return this.validateListResponse(response.data, 'data-table-rows');
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async insertDataTableRows(id, params) {
        try {
            const response = await this.client.post(`/data-tables/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'dataTableId')}/rows`, params);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async updateDataTableRows(id, params) {
        try {
            const response = await this.client.patch(`/data-tables/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'dataTableId')}/rows/update`, params);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async upsertDataTableRow(id, params) {
        try {
            const response = await this.client.post(`/data-tables/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'dataTableId')}/rows/upsert`, params);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async deleteDataTableRows(id, params) {
        try {
            const response = await this.client.delete(`/data-tables/${(0, validation_schemas_1.encodeApiPathSegment)(id, 'dataTableId')}/rows/delete`, {
                params,
                paramsSerializer: (p) => this.serializeQueryParams(p),
            });
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async createFolder(projectId, data) {
        try {
            const response = await this.client.post(`/projects/${(0, validation_schemas_1.encodeApiPathSegment)(projectId, 'projectId')}/folders`, data);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async listFolders(projectId, params = {}) {
        try {
            const { filter, select, ...rest } = params;
            const response = await this.client.get(`/projects/${(0, validation_schemas_1.encodeApiPathSegment)(projectId, 'projectId')}/folders`, {
                params: {
                    ...rest,
                    ...(filter && Object.keys(filter).length > 0 ? { filter: JSON.stringify(filter) } : {}),
                    ...(select && select.length > 0 ? { select: JSON.stringify(select) } : {}),
                },
                paramsSerializer: (p) => this.serializeQueryParams(p),
            });
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async getFolder(projectId, folderId) {
        try {
            const response = await this.client.get(`/projects/${(0, validation_schemas_1.encodeApiPathSegment)(projectId, 'projectId')}/folders/${(0, validation_schemas_1.encodeApiPathSegment)(folderId, 'folderId')}`);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async updateFolder(projectId, folderId, data) {
        try {
            const response = await this.client.patch(`/projects/${(0, validation_schemas_1.encodeApiPathSegment)(projectId, 'projectId')}/folders/${(0, validation_schemas_1.encodeApiPathSegment)(folderId, 'folderId')}`, data);
            return response.data;
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async deleteFolder(projectId, folderId, transferToFolderId) {
        try {
            await this.client.delete(`/projects/${(0, validation_schemas_1.encodeApiPathSegment)(projectId, 'projectId')}/folders/${(0, validation_schemas_1.encodeApiPathSegment)(folderId, 'folderId')}`, { params: transferToFolderId ? { transferToFolderId } : {} });
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async listProjects(limit = 100) {
        try {
            const response = await this.client.get('/projects', { params: { limit } });
            const payload = response.data;
            return Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
    }
    async resolvePersonalProjectId() {
        if (this.personalProjectId)
            return this.personalProjectId;
        let projects = [];
        let truncated = false;
        let projectsApiAvailable = true;
        try {
            const response = await this.client.get('/projects', { params: { limit: 100 } });
            if (Array.isArray(response.data?.data))
                projects = response.data.data;
            truncated = Boolean(response.data?.nextCursor);
        }
        catch (error) {
            const apiError = (0, n8n_errors_1.handleN8nApiError)(error);
            if (apiError.statusCode !== 403 && apiError.statusCode !== 404)
                throw apiError;
            projectsApiAvailable = false;
        }
        if (projectsApiAvailable) {
            if (truncated) {
                throw new n8n_errors_1.N8nValidationError(`This instance has more projects than one listing page; resolving 'personal' from a ` +
                    `truncated listing could pick the wrong project. Pass an explicit projectId.`);
            }
            const personal = projects.filter(p => p.type === 'personal');
            if (personal.length === 1) {
                this.personalProjectId = personal[0].id;
                return personal[0].id;
            }
            if (personal.length > 1) {
                throw new n8n_errors_1.N8nValidationError(`This API key sees ${personal.length} personal projects, so 'personal' is ambiguous. ` +
                    `Pass an explicit projectId. Visible personal projects: ` +
                    personal.map(p => `${p.id} (${p.name})`).join(', '));
            }
            throw new n8n_errors_1.N8nValidationError(`The projects listing shows no personal project for this API key. Pass an explicit projectId.`);
        }
        try {
            const response = await this.client.get('/workflows', { params: { limit: 1 } });
            const workflow = Array.isArray(response.data?.data) ? response.data.data[0] : undefined;
            const projectId = workflow?.shared?.[0]?.projectId;
            if (typeof projectId === 'string' && projectId.length > 0) {
                this.personalProjectId = projectId;
                return projectId;
            }
        }
        catch (error) {
            throw (0, n8n_errors_1.handleN8nApiError)(error);
        }
        throw new n8n_errors_1.N8nValidationError(`Could not resolve the 'personal' project: the projects API is not available on this instance ` +
            `and no workflow exists to infer the project from. Create any workflow first, or pass an ` +
            `explicit projectId. (The folder 'create' action itself accepts 'personal' directly.)`);
    }
    serializeQueryParams(params) {
        const parts = [];
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null)
                continue;
            if (typeof value === 'string' && value.trim() === '')
                continue;
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
        return parts.join('&');
    }
    validateListResponse(responseData, resourceType) {
        if (!responseData || typeof responseData !== 'object') {
            throw new Error(`Invalid response from n8n API for ${resourceType}: response is not an object`);
        }
        if (Array.isArray(responseData)) {
            logger_1.logger.warn(`n8n API returned array directly instead of {data, nextCursor} object for ${resourceType}. ` +
                'Wrapping in expected format for backwards compatibility.');
            return {
                data: responseData,
                nextCursor: null
            };
        }
        if (!Array.isArray(responseData.data)) {
            const keys = Object.keys(responseData).slice(0, 5);
            const keysPreview = keys.length < Object.keys(responseData).length
                ? `${keys.join(', ')}...`
                : keys.join(', ');
            throw new Error(`Invalid response from n8n API for ${resourceType}: expected {data: [], nextCursor?: string}, ` +
                `got object with keys: [${keysPreview}]`);
        }
        return responseData;
    }
}
exports.N8nApiClient = N8nApiClient;
N8nApiClient.PINNED_AGENTS_TTL_MS = 60000;
//# sourceMappingURL=n8n-api-client.js.map