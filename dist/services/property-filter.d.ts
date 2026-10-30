export interface SimplifiedProperty {
    name: string;
    displayName: string;
    type: string;
    description: string;
    default?: any;
    options?: Array<{
        value: string;
        label: string;
        description?: string;
    }>;
    required?: boolean;
    placeholder?: string;
    showWhen?: Record<string, any>;
    usageHint?: string;
    expectedFormat?: {
        structure: Record<string, string>;
        modes?: string[];
        example: Record<string, any>;
    };
    dynamicOptions?: {
        methodName: string;
        methodType: 'loadOptions' | 'listSearch';
        dependsOn: string[];
    };
}
export interface EssentialConfig {
    required: string[];
    common: string[];
    categoryPriority?: string[];
}
export interface FilteredProperties {
    required: SimplifiedProperty[];
    common: SimplifiedProperty[];
}
export declare class PropertyFilter {
    private static ESSENTIAL_PROPERTIES;
    static deduplicateProperties(properties: any[]): any[];
    static getEssentials(allProperties: any[], nodeType: string, version?: string | number): FilteredProperties;
    private static resolveVersionGates;
    private static mergeOptionsCollections;
    private static describeConditions;
    private static withoutVersionGate;
    private static describeRule;
    private static describeField;
    private static isOperatorCondition;
    private static describeOperator;
    private static extractProperties;
    private static findPropertyByName;
    private static simplifyProperty;
    private static readonly MAX_CHILD_SETTINGS;
    private static readonly MAX_NESTED_NAMES;
    private static readonly MAX_INLINE_VALUES;
    private static readonly MAX_LINE_DESCRIPTION;
    private static summarizeChildren;
    private static oneLine;
    private static nestedFields;
    private static variantKey;
    private static uniqueVariants;
    private static uniqueByName;
    private static fieldLabel;
    private static choiceValues;
    private static firstSentence;
    private static extractDynamicOptions;
    private static generateUsageHint;
    private static extractDescription;
    private static generateDescription;
    private static inferEssentials;
    static searchProperties(allProperties: any[], query: string, maxResults?: number): SimplifiedProperty[];
    private static searchPropertiesRecursive;
}
//# sourceMappingURL=property-filter.d.ts.map