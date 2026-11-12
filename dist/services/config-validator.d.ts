export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    suggestions: string[];
    visibleProperties: string[];
    hiddenProperties: string[];
    autofix?: Record<string, any>;
}
export interface ValidationError {
    type: 'missing_required' | 'invalid_type' | 'invalid_value' | 'incompatible' | 'invalid_configuration' | 'syntax_error';
    property: string;
    message: string;
    fix?: string;
    suggestion?: string;
}
export interface ValidationWarning {
    type: 'missing_common' | 'deprecated' | 'inefficient' | 'security' | 'best_practice' | 'invalid_value';
    property?: string;
    message: string;
    suggestion?: string;
}
export declare class ConfigValidator {
    private static readonly UI_ONLY_TYPES;
    static validate(nodeType: string, config: Record<string, any>, properties: any[], userProvidedKeys?: Set<string>): ValidationResult;
    static validateBatch(configs: Array<{
        nodeType: string;
        config: Record<string, any>;
        properties: any[];
    }>): ValidationResult[];
    private static checkRequiredProperties;
    private static getPropertyVisibility;
    private static evaluateCondition;
    private static valueMatches;
    static isPropertyVisible(prop: any, config: Record<string, any>): boolean;
    private static validatePropertyTypes;
    private static performNodeSpecificValidation;
    private static validateHttpRequest;
    private static validateWebhook;
    private static validateDatabase;
    private static validateCode;
    private static checkCommonIssues;
    private static performSecurityChecks;
    private static getVisibilityRequirement;
    private static validateJavaScriptSyntax;
    private static validatePythonSyntax;
    private static validateN8nCodePatterns;
    private static isLineTerminator;
    private static readonly WHITESPACE;
    private static isWhitespace;
    private static countQuotesInStringLiterals;
    private static hasControlStructureWithoutColon;
    private static hasReturnOfPlainObject;
}
//# sourceMappingURL=config-validator.d.ts.map