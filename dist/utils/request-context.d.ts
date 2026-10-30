import type { InstanceContext } from '../types/instance-context';
interface RequestScope {
    owner: object;
    instanceContext: InstanceContext | undefined;
}
export declare function runWithRequestContext<T>(owner: object, instanceContext: InstanceContext | undefined, fn: () => T): T;
export declare function getRequestScope(owner: object): RequestScope | undefined;
export {};
//# sourceMappingURL=request-context.d.ts.map