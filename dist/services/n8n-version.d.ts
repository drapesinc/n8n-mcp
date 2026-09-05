import { N8nVersionInfo } from '../types/n8n-api';
import type { PinnedAgents } from '../utils/ssrf-protection';
import { type SettingsVersion } from '../constants/workflow-settings';
export declare const N8N_VERSION_UNAVAILABLE_NOTE: string;
export declare function parseVersion(versionString: string): N8nVersionInfo | null;
export declare function compareVersions(a: SettingsVersion, b: SettingsVersion): number;
export declare function versionAtLeast(version: N8nVersionInfo, major: number, minor: number, patch?: number): boolean;
export declare function getSupportedSettingsProperties(version: N8nVersionInfo): Set<string>;
export declare function fetchN8nVersion(baseUrl: string, options?: {
    headers?: Record<string, string>;
    pinnedAgents?: PinnedAgents;
    forceRefresh?: boolean;
}): Promise<N8nVersionInfo | null>;
export declare function clearVersionCache(): void;
export declare function getCachedVersion(baseUrl: string): N8nVersionInfo | null;
export declare function setCachedVersion(baseUrl: string, version: N8nVersionInfo): void;
export declare function cleanSettingsForVersion(settings: Record<string, unknown> | undefined, version: N8nVersionInfo | null): Record<string, unknown>;
export declare function settingsRejectionLadder(settings: unknown): string[][];
export declare const VERSION_THRESHOLDS: {
    EXECUTION_ORDER: {
        major: number;
        minor: number;
        patch: number;
    };
    CALLER_POLICY: {
        major: number;
        minor: number;
        patch: number;
    };
    SETTINGS_PASS_THROUGH: SettingsVersion;
};
//# sourceMappingURL=n8n-version.d.ts.map