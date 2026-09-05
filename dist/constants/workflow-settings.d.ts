export interface SettingsVersion {
    major: number;
    minor: number;
    patch: number;
}
export interface WorkflowSettingProperty {
    since: SettingsVersion;
    derived?: true;
    entityOnly?: true;
}
export declare const WORKFLOW_SETTINGS_PROPERTIES: Record<string, WorkflowSettingProperty>;
export declare const SETTINGS_PASS_THROUGH_FLOOR: SettingsVersion;
export declare const DERIVED_SETTINGS_PROPERTIES: ReadonlySet<string>;
//# sourceMappingURL=workflow-settings.d.ts.map