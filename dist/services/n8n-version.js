"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION_THRESHOLDS = exports.N8N_VERSION_UNAVAILABLE_NOTE = void 0;
exports.parseVersion = parseVersion;
exports.compareVersions = compareVersions;
exports.versionAtLeast = versionAtLeast;
exports.getSupportedSettingsProperties = getSupportedSettingsProperties;
exports.fetchN8nVersion = fetchN8nVersion;
exports.clearVersionCache = clearVersionCache;
exports.getCachedVersion = getCachedVersion;
exports.setCachedVersion = setCachedVersion;
exports.cleanSettingsForVersion = cleanSettingsForVersion;
exports.settingsRejectionLadder = settingsRejectionLadder;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const workflow_settings_1 = require("../constants/workflow-settings");
exports.N8N_VERSION_UNAVAILABLE_NOTE = 'Not reported. n8n stopped exposing its version to API clients in 1.119.0, so this is expected ' +
    'and is not an error. Feature availability is detected from API responses instead.';
const VERSION_CACHE_TTL_MS = 5 * 60 * 1000;
const versionCache = new Map();
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
    return compareVersions(version, { major, minor, patch }) >= 0;
}
function getSupportedSettingsProperties(version) {
    const supported = new Set();
    for (const [name, meta] of Object.entries(workflow_settings_1.WORKFLOW_SETTINGS_PROPERTIES)) {
        if (meta.derived)
            continue;
        if (compareVersions(version, meta.since) >= 0) {
            supported.add(name);
        }
    }
    return supported;
}
async function fetchN8nVersion(baseUrl, options) {
    const { headers, pinnedAgents, forceRefresh } = options ?? {};
    const cached = forceRefresh ? undefined : versionCache.get(baseUrl);
    if (cached && Date.now() - cached.fetchedAt < VERSION_CACHE_TTL_MS) {
        logger_1.logger.debug(`Using cached n8n version for ${baseUrl}: ${cached.info?.version ?? 'none reported'}`);
        return cached.info;
    }
    try {
        const cleanBaseUrl = baseUrl.replace(/\/api\/v\d+\/?$/, '').replace(/\/$/, '');
        const settingsUrl = `${cleanBaseUrl}/rest/settings`;
        logger_1.logger.debug(`Fetching n8n version from ${settingsUrl}`);
        const response = await axios_1.default.get(settingsUrl, {
            timeout: 5000,
            headers,
            validateStatus: (status) => status < 500,
            maxRedirects: 0,
            httpAgent: pinnedAgents?.httpAgent,
            httpsAgent: pinnedAgents?.httpsAgent,
        });
        const settings = response.status === 200 ? response.data?.data : undefined;
        const versionString = typeof settings?.n8nVersion === 'string'
            ? settings.n8nVersion
            : typeof settings?.versionCli === 'string'
                ? settings.versionCli
                : null;
        const versionInfo = versionString ? parseVersion(versionString) : null;
        return rememberProbe(baseUrl, versionInfo, versionInfo
            ? `detected n8n version ${versionInfo.version}`
            : `no version in the response from ${settingsUrl}`);
    }
    catch (error) {
        logger_1.logger.debug(`Failed to fetch n8n version: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
    }
}
function rememberProbe(baseUrl, info, reason) {
    versionCache.set(baseUrl, { info, fetchedAt: Date.now() });
    logger_1.logger.debug(`n8n version probe for ${baseUrl}: ${reason}`);
    return info;
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
    const passThrough = !version || compareVersions(version, workflow_settings_1.SETTINGS_PASS_THROUGH_FLOOR) >= 0;
    const supportedProperties = passThrough ? null : getSupportedSettingsProperties(version);
    const target = version ? `n8n ${version.version}` : 'n8n version unknown';
    const cleaned = {};
    for (const [key, value] of Object.entries(settings)) {
        if (workflow_settings_1.DERIVED_SETTINGS_PROPERTIES.has(key)) {
            logger_1.logger.debug(`Dropped derived settings property n8n ignores on write: ${key}`);
            continue;
        }
        if (supportedProperties && !supportedProperties.has(key)) {
            logger_1.logger.debug(`Filtered out unsupported settings property: ${key} (${target})`);
            continue;
        }
        cleaned[key] = value;
    }
    return cleaned;
}
const SETTINGS_LADDER_FLOOR = { major: 1, minor: 119, patch: 0 };
function settingsRejectionLadder(settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings))
        return [];
    const keys = Object.keys(settings);
    const known = (key) => Object.prototype.hasOwnProperty.call(workflow_settings_1.WORKFLOW_SETTINGS_PROPERTIES, key);
    const since = (key) => workflow_settings_1.WORKFLOW_SETTINGS_PROPERTIES[key].since;
    const unknown = keys.filter(key => !known(key));
    const newestFirst = keys
        .filter(key => known(key) && compareVersions(since(key), SETTINGS_LADDER_FLOOR) > 0)
        .sort((a, b) => compareVersions(since(b), since(a)));
    return [
        ...(unknown.length > 0 ? [unknown] : []),
        ...newestFirst.map(key => [key]),
    ];
}
exports.VERSION_THRESHOLDS = {
    EXECUTION_ORDER: { major: 1, minor: 37, patch: 0 },
    CALLER_POLICY: { major: 1, minor: 119, patch: 0 },
    SETTINGS_PASS_THROUGH: workflow_settings_1.SETTINGS_PASS_THROUGH_FLOOR,
};
//# sourceMappingURL=n8n-version.js.map