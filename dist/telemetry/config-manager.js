"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryConfigManager = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
const crypto_1 = require("crypto");
const os_2 = require("os");
class TelemetryConfigManager {
    constructor() {
        this.config = null;
        this.configDir = (0, path_1.join)((0, os_1.homedir)(), '.n8n-mcp');
        this.configPath = (0, path_1.join)(this.configDir, 'telemetry.json');
    }
    static getInstance() {
        if (!TelemetryConfigManager.instance) {
            TelemetryConfigManager.instance = new TelemetryConfigManager();
        }
        return TelemetryConfigManager.instance;
    }
    generateUserId() {
        if (process.env.IS_DOCKER === 'true' || this.isCloudEnvironment()) {
            return this.generateDockerStableId();
        }
        const machineId = `${(0, os_2.hostname)()}-${(0, os_2.platform)()}-${(0, os_2.arch)()}-${(0, os_1.homedir)()}`;
        return (0, crypto_1.createHash)('sha256').update(machineId).digest('hex').substring(0, 16);
    }
    generateDockerStableId() {
        const bootId = this.readBootId();
        if (bootId) {
            const fingerprint = `${bootId}-${(0, os_2.platform)()}-${(0, os_2.arch)()}`;
            return (0, crypto_1.createHash)('sha256').update(fingerprint).digest('hex').substring(0, 16);
        }
        const combinedFingerprint = this.generateCombinedFingerprint();
        if (combinedFingerprint) {
            return combinedFingerprint;
        }
        const genericId = `docker-${(0, os_2.platform)()}-${(0, os_2.arch)()}`;
        return (0, crypto_1.createHash)('sha256').update(genericId).digest('hex').substring(0, 16);
    }
    readBootId() {
        try {
            const bootIdPath = '/proc/sys/kernel/random/boot_id';
            if (!(0, fs_1.existsSync)(bootIdPath)) {
                return null;
            }
            const bootId = (0, fs_1.readFileSync)(bootIdPath, 'utf-8').trim();
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(bootId)) {
                return null;
            }
            return bootId;
        }
        catch (error) {
            return null;
        }
    }
    generateCombinedFingerprint() {
        try {
            const signals = [];
            if ((0, fs_1.existsSync)('/proc/cpuinfo')) {
                const cpuinfo = (0, fs_1.readFileSync)('/proc/cpuinfo', 'utf-8');
                const cores = (cpuinfo.match(/processor\s*:/g) || []).length;
                if (cores > 0) {
                    signals.push(`cores:${cores}`);
                }
            }
            if ((0, fs_1.existsSync)('/proc/meminfo')) {
                const meminfo = (0, fs_1.readFileSync)('/proc/meminfo', 'utf-8');
                const totalMatch = meminfo.match(/MemTotal:\s+(\d+)/);
                if (totalMatch) {
                    signals.push(`mem:${totalMatch[1]}`);
                }
            }
            if ((0, fs_1.existsSync)('/proc/version')) {
                const version = (0, fs_1.readFileSync)('/proc/version', 'utf-8');
                const kernelMatch = version.match(/Linux version ([\d.]+)/);
                if (kernelMatch) {
                    signals.push(`kernel:${kernelMatch[1]}`);
                }
            }
            signals.push((0, os_2.platform)(), (0, os_2.arch)());
            if (signals.length < 3) {
                return null;
            }
            const fingerprint = signals.join('-');
            return (0, crypto_1.createHash)('sha256').update(fingerprint).digest('hex').substring(0, 16);
        }
        catch (error) {
            return null;
        }
    }
    isCloudEnvironment() {
        return !!(process.env.RAILWAY_ENVIRONMENT ||
            process.env.RENDER ||
            process.env.FLY_APP_NAME ||
            process.env.HEROKU_APP_NAME ||
            process.env.AWS_EXECUTION_ENV ||
            process.env.KUBERNETES_SERVICE_HOST ||
            process.env.GOOGLE_CLOUD_PROJECT ||
            process.env.AZURE_FUNCTIONS_ENVIRONMENT);
    }
    loadConfig() {
        if (this.config) {
            return this.config;
        }
        if (!(0, fs_1.existsSync)(this.configPath)) {
            const version = this.getPackageVersion();
            const envDisabled = this.isDisabledByEnvironment();
            this.config = {
                enabled: !envDisabled,
                userId: this.generateUserId(),
                firstRun: new Date().toISOString(),
                version
            };
            this.saveConfig();
            if (!envDisabled) {
                this.showFirstRunNotice();
            }
            return this.config;
        }
        try {
            const rawConfig = (0, fs_1.readFileSync)(this.configPath, 'utf-8');
            this.config = JSON.parse(rawConfig);
            if (!this.config.userId) {
                this.config.userId = this.generateUserId();
                this.saveConfig();
            }
            return this.config;
        }
        catch (error) {
            console.error('Failed to load telemetry config, using defaults:', error);
            this.config = {
                enabled: false,
                userId: this.generateUserId()
            };
            return this.config;
        }
    }
    saveConfig() {
        if (!this.config)
            return;
        try {
            if (!(0, fs_1.existsSync)(this.configDir)) {
                (0, fs_1.mkdirSync)(this.configDir, { recursive: true });
            }
            this.config.lastModified = new Date().toISOString();
            (0, fs_1.writeFileSync)(this.configPath, JSON.stringify(this.config, null, 2));
        }
        catch (error) {
            console.error('Failed to save telemetry config:', error);
        }
    }
    isEnabled() {
        if (this.isDisabledByEnvironment()) {
            return false;
        }
        const config = this.loadConfig();
        return config.enabled;
    }
    isDisabledByEnvironment() {
        const envVars = [
            'N8N_MCP_TELEMETRY_DISABLED',
            'TELEMETRY_DISABLED',
            'DISABLE_TELEMETRY'
        ];
        for (const varName of envVars) {
            const value = process.env[varName];
            if (value !== undefined) {
                const normalized = value.toLowerCase().trim();
                if (!['true', 'false', '1', '0', ''].includes(normalized)) {
                    console.warn(`⚠️  Invalid telemetry environment variable value: ${varName}="${value}"\n` +
                        `   Use "true" to disable or "false" to enable telemetry.`);
                }
                if (normalized === 'true' || normalized === '1') {
                    return true;
                }
            }
        }
        return false;
    }
    getUserId() {
        const config = this.loadConfig();
        return config.userId;
    }
    isFirstRun() {
        return !(0, fs_1.existsSync)(this.configPath);
    }
    enable() {
        const config = this.loadConfig();
        config.enabled = true;
        this.config = config;
        this.saveConfig();
        console.log('✓ Telemetry enabled');
    }
    disable() {
        const config = this.loadConfig();
        config.enabled = false;
        this.config = config;
        this.saveConfig();
        console.log('✓ Telemetry disabled');
    }
    getStatus() {
        const config = this.loadConfig();
        const envDisabled = this.isDisabledByEnvironment();
        let status = config.enabled ? 'ENABLED' : 'DISABLED';
        if (envDisabled) {
            status = 'DISABLED (via environment variable)';
        }
        return `
Telemetry Status: ${status}
Installation ID: ${config.userId}
First Run: ${config.firstRun || 'Unknown'}
Config Path: ${this.configPath}

To opt-out: npx n8n-mcp telemetry disable
To opt-in:  npx n8n-mcp telemetry enable

For Docker: Set N8N_MCP_TELEMETRY_DISABLED=true
`;
    }
    showFirstRunNotice() {
        const width = 60;
        const row = (text = '') => `║ ${text.padEnd(width)}║`;
        const id = this.config?.userId || 'generating...';
        const lines = [
            `╔${'═'.repeat(width + 1)}╗`,
            row('Usage Telemetry'),
            `╠${'═'.repeat(width + 1)}╣`,
            row(),
            row('n8n-mcp sends pseudonymous usage data to improve the tool'),
            row('and to build datasets and models for workflow generation.'),
            row(),
            row('We collect:'),
            row('• Which MCP tools are used, timing, and success rates'),
            row('• Workflow structures, including node settings after'),
            row('  credentials, URLs, emails, and keys are removed'),
            row('• The "intent" text passed to workflow update tools'),
            row('• Error categories and system information'),
            row(),
            row('We never collect:'),
            row('• API keys, tokens, or credentials'),
            row('• URLs, hostnames, or your n8n instance address'),
            row('• Names, emails, or account details'),
            row('• Workflow execution data or pinned data'),
            row(),
            row(`Your installation ID: ${id}`),
            row(),
            row('Leaving telemetry enabled means you accept the terms'),
            row('in the policy linked below.'),
            row(),
            row('To opt out at any time:'),
            row('npx n8n-mcp telemetry disable'),
            row(),
            row('Data deletion requests:'),
            row('Email romuald@n8n-mcp.com with your installation ID'),
            row(),
            row('Full policy:'),
            row('https://github.com/czlonkowski/n8n-mcp/blob/main/PRIVACY.md'),
            row(),
            `╚${'═'.repeat(width + 1)}╝`,
        ];
        process.stderr.write(`\n${lines.join('\n')}\n`);
    }
    getPackageVersion() {
        try {
            const possiblePaths = [
                (0, path_1.resolve)(__dirname, '..', '..', 'package.json'),
                (0, path_1.resolve)(process.cwd(), 'package.json'),
                (0, path_1.resolve)(__dirname, '..', '..', '..', 'package.json')
            ];
            for (const packagePath of possiblePaths) {
                if ((0, fs_1.existsSync)(packagePath)) {
                    const packageJson = JSON.parse((0, fs_1.readFileSync)(packagePath, 'utf-8'));
                    if (packageJson.version) {
                        return packageJson.version;
                    }
                }
            }
            try {
                const packageJson = require('../../package.json');
                return packageJson.version || 'unknown';
            }
            catch {
            }
            return 'unknown';
        }
        catch (error) {
            return 'unknown';
        }
    }
}
exports.TelemetryConfigManager = TelemetryConfigManager;
//# sourceMappingURL=config-manager.js.map