import { N8nVersionInfo } from '../types/n8n-api';
import type { PinnedAgents } from '../utils/ssrf-protection';
export declare function parseVersion(versionString: string): N8nVersionInfo | null;
export declare function compareVersions(a: N8nVersionInfo, b: N8nVersionInfo): number;
export declare function versionAtLeast(version: N8nVersionInfo, major: number, minor: number, patch?: number): boolean;
export declare function getSupportedSettingsProperties(version: N8nVersionInfo): Set<string>;
export declare function fetchN8nVersion(baseUrl: string, pinnedAgents?: PinnedAgents): Promise<N8nVersionInfo | null>;
export declare function clearVersionCache(): void;
export declare function getCachedVersion(baseUrl: string): N8nVersionInfo | null;
export declare function setCachedVersion(baseUrl: string, version: N8nVersionInfo): void;
export declare function cleanSettingsForVersion(settings: Record<string, unknown> | undefined, version: N8nVersionInfo | null): Record<string, unknown>;
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
};
//# sourceMappingURL=n8n-version.d.ts.map