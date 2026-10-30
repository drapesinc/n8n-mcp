import type { InstanceContext } from '../types/instance-context';
export declare const INSTANCE_ARGUMENT = "instance";
export declare function isInstanceArgumentEnabled(context?: InstanceContext): boolean;
export declare function withInstanceArgument<T extends {
    inputSchema?: any;
}>(tool: T): T;
export declare function withoutInstanceArgument<T extends Record<string, any> | undefined>(args: T): T;
//# sourceMappingURL=instance-argument.d.ts.map