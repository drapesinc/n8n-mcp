import { z } from 'zod';
import { Workflow } from '../../types/n8n-api';
import { InstanceContext } from '../../types/instance-context';
import { N8nApiClient } from '../../services/n8n-api-client';
import { TriggerType, TriggerResponse, TriggerHandlerCapabilities, DetectedTrigger, BaseTriggerInput } from '../types';
export type TriggerHandlerConstructor = new (client: N8nApiClient, context?: InstanceContext) => BaseTriggerHandler;
export declare abstract class BaseTriggerHandler<T extends BaseTriggerInput = BaseTriggerInput> {
    protected client: N8nApiClient;
    protected context?: InstanceContext;
    abstract readonly triggerType: TriggerType;
    abstract readonly capabilities: TriggerHandlerCapabilities;
    abstract readonly inputSchema: z.ZodSchema<T>;
    constructor(client: N8nApiClient, context?: InstanceContext);
    validate(input: unknown): T;
    abstract execute(input: T, workflow: Workflow, triggerInfo?: DetectedTrigger): Promise<TriggerResponse>;
    protected isUnderTriggerPrefix(triggerUrl: string, baseUrl: string, prefix: string): boolean;
    protected getBaseUrl(): string | undefined;
    protected getApiKey(): string | undefined;
    protected normalizeResponse(result: unknown, input: T, startTime: number, extra?: Partial<TriggerResponse>): TriggerResponse;
    protected errorResponse(input: BaseTriggerInput, error: string, startTime: number, extra?: Partial<TriggerResponse>): TriggerResponse;
}
//# sourceMappingURL=base-handler.d.ts.map