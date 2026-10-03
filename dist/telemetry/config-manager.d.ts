export interface TelemetryConfig {
    enabled: boolean;
    userId: string;
    firstRun?: string;
    lastModified?: string;
    version?: string;
    disabledByServer?: {
        version: string;
        at: string;
    };
}
export declare class TelemetryConfigManager {
    private static instance;
    private readonly configDir;
    private readonly configPath;
    private config;
    private cachedPackageVersion;
    private constructor();
    static getInstance(): TelemetryConfigManager;
    private generateUserId;
    private generateDockerStableId;
    private readBootId;
    private generateCombinedFingerprint;
    private isCloudEnvironment;
    loadConfig(): TelemetryConfig;
    private saveConfig;
    isEnabled(): boolean;
    recordServerDisable(version: string): void;
    private isDisabledByEnvironment;
    getUserId(): string;
    isFirstRun(): boolean;
    enable(): void;
    disable(): void;
    getStatus(): string;
    private showFirstRunNotice;
    getPackageVersion(): string;
    private resolvePackageVersion;
}
//# sourceMappingURL=config-manager.d.ts.map