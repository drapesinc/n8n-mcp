export interface InstanceContext {
    n8nApiUrl?: string;
    n8nApiKey?: string;
    n8nApiTimeout?: number;
    n8nApiMaxRetries?: number;
    instanceId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
}
export declare function isInstanceContext(obj: any): obj is InstanceContext;
export declare function validateInstanceContext(context: InstanceContext): {
    valid: boolean;
    errors?: string[];
};
export declare function getInstanceScopeId(context?: InstanceContext): string;
//# sourceMappingURL=instance-context.d.ts.map