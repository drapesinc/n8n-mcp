import type { InstanceContext } from '../../types/instance-context';
import type { UIAppEntry } from './types';
export declare function isUIAppsEnabled(context?: InstanceContext): boolean;
export declare class UIAppRegistry {
    private static entries;
    private static toolIndex;
    private static loaded;
    static load(): void;
    static getAppForTool(toolName: string): UIAppEntry | null;
    static getAppById(id: string): UIAppEntry | null;
    static getAllApps(): UIAppEntry[];
    static injectToolMeta<T extends {
        name: string;
        _meta?: Record<string, unknown>;
    }>(tools: T[]): T[];
    static reset(): void;
}
//# sourceMappingURL=registry.d.ts.map