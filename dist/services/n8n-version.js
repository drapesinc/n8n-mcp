"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION_THRESHOLDS = void 0;
exports.parseVersion = parseVersion;
exports.compareVersions = compareVersions;
exports.versionAtLeast = versionAtLeast;
exports.getSupportedSettingsProperties = getSupportedSettingsProperties;
exports.fetchN8nVersion = fetchN8nVersion;
exports.clearVersionCache = clearVersionCache;
exports.getCachedVersion = getCachedVersion;
exports.setCachedVersion = setCachedVersion;
exports.cleanSettingsForVersion = cleanSettingsForVersion;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const VERSION_CACHE_TTL_MS = 5 * 60 * 1000;
const versionCache = new Map();
const SETTINGS_BY_VERSION = {
    core: [
        'saveExecutionProgress',
        'saveManualExecutions',
        'saveDataErrorExecution',
        'saveDataSuccessExecution',
        'executionTimeout',
        'errorWorkflow',
        'timezone',
    ],
    v1_37_0: [
        'executionOrder',
    ],
    v1_119_0: [
        'callerPolicy',
        'callerIds',
        'timeSavedPerExecution',
        'availableInMCP',
    ],
};
function parseVersion(versionString) {
    const match = versionString.match(/^v?(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
        return null;
    }
    return {
        version: versionString,
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
    };
}
function compareVersions(a, b) {
    if (a.major !== b.major)
        return a.major - b.major;
    if (a.minor !== b.minor)
        return a.minor - b.minor;
    return a.patch - b.patch;
}
function versionAtLeast(version, major, minor, patch = 0) {
    const target = { version: '', major, minor, patch };
    return compareVersions(version, target) >= 0;
}
function getSupportedSettingsProperties(version) {
    const supported = new Set(SETTINGS_BY_VERSION.core);
    if (versionAtLeast(version, 1, 37, 0)) {
        SETTINGS_BY_VERSION.v1_37_0.forEach(prop => supported.add(prop));
    }
    if (versionAtLeast(version, 1, 119, 0)) {
        SETTINGS_BY_VERSION.v1_119_0.forEach(prop => supported.add(prop));
    }
    return supported;
}
async function fetchN8nVersion(baseUrl, pinnedAgents) {
    const cached = versionCache.get(baseUrl);
    if (cached && Date.now() - cached.fetchedAt < VERSION_CACHE_TTL_MS) {
        logger_1.logger.debug(`Using cached n8n version for ${baseUrl}: ${cached.info.version}`);
        return cached.info;
    }
    try {
        const cleanBaseUrl = baseUrl.replace(/\/api\/v\d+\/?$/, '').replace(/\/$/, '');
        const settingsUrl = `${cleanBaseUrl}/rest/settings`;
        logger_1.logger.debug(`Fetching n8n version from ${settingsUrl}`);
        const response = await axios_1.default.get(settingsUrl, {
            timeout: 5000,
            validateStatus: (status) => status < 500,
            maxRedirects: 0,
            httpAgent: pinnedAgents?.httpAgent,
            httpsAgent: pinnedAgents?.httpsAgent,
        });
        if (response.status === 200 && response.data) {
            const settings = response.data.data;
            if (!settings) {
                logger_1.logger.warn('No data in settings response');
                return null;
            }
            const versionString = typeof settings.n8nVersion === 'string'
                ? settings.n8nVersion
                : typeof settings.versionCli === 'string'
                    ? settings.versionCli
                    : null;
            if (versionString) {
                const versionInfo = parseVersion(versionString);
                if (versionInfo) {
                    versionCache.set(baseUrl, { info: versionInfo, fetchedAt: Date.now() });
                    logger_1.logger.debug(`Detected n8n version: ${versionInfo.version}`);
                    return versionInfo;
                }
            }
        }
        logger_1.logger.warn(`Could not determine n8n version from ${settingsUrl}`);
        return null;
    }
    catch (error) {
        logger_1.logger.warn(`Failed to fetch n8n version: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
    }
}
function clearVersionCache() {
    versionCache.clear();
}
function getCachedVersion(baseUrl) {
    const cached = versionCache.get(baseUrl);
    if (cached && Date.now() - cached.fetchedAt < VERSION_CACHE_TTL_MS) {
        return cached.info;
    }
    return null;
}
function setCachedVersion(baseUrl, version) {
    versionCache.set(baseUrl, { info: version, fetchedAt: Date.now() });
}
function cleanSettingsForVersion(settings, version) {
    if (!settings || typeof settings !== 'object') {
        return {};
    }
    if (!version) {
        return settings;
    }
    const supportedProperties = getSupportedSettingsProperties(version);
    const cleaned = {};
    for (const [key, value] of Object.entries(settings)) {
        if (supportedProperties.has(key)) {
            cleaned[key] = value;
        }
        else {
            logger_1.logger.debug(`Filtered out unsupported settings property: ${key} (n8n ${version.version})`);
        }
    }
    return cleaned;
}
exports.VERSION_THRESHOLDS = {
    EXECUTION_ORDER: { major: 1, minor: 37, patch: 0 },
    CALLER_POLICY: { major: 1, minor: 119, patch: 0 },
};
//# sourceMappingURL=n8n-version.js.map