export declare class ValidationError extends Error {
    field?: string | undefined;
    value?: any | undefined;
    constructor(message: string, field?: string | undefined, value?: any | undefined);
}
export declare function encodeApiPathSegment(value: unknown, fieldName: string): string;
export interface ValidationResult {
    valid: boolean;
    errors: Array<{
        field: string;
        message: string;
        value?: any;
    }>;
}
export declare class Validator {
    static validateString(value: any, fieldName: string, required?: boolean): ValidationResult;
    static validateObject(value: any, fieldName: string, required?: boolean): ValidationResult;
    static validateArray(value: any, fieldName: string, required?: boolean): ValidationResult;
    static validateNumber(value: any, fieldName: string, required?: boolean, min?: number, max?: number): ValidationResult;
    static validateEnum<T>(value: any, fieldName: string, allowedValues: T[], required?: boolean): ValidationResult;
    static combineResults(...results: ValidationResult[]): ValidationResult;
    static formatErrors(result: ValidationResult, toolName?: string): string;
}
export declare class ToolValidation {
    static validateNodeOperation(args: any): ValidationResult;
    static validateNodeMinimal(args: any): ValidationResult;
    static validateWorkflow(args: any): ValidationResult;
    static validateSearchNodes(args: any): ValidationResult;
    static validateListNodeTemplates(args: any): ValidationResult;
    static validateWorkflowId(args: any): ValidationResult;
    static validateCreateWorkflow(args: any): ValidationResult;
}
//# sourceMappingURL=validation-schemas.d.ts.map