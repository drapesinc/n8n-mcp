import { InstanceContext } from './instance-context.js';
export interface SessionState {
    sessionId: string;
    metadata: {
        createdAt: string;
        lastAccess: string;
    };
    context: Omit<InstanceContext, 'n8nApiUrl' | 'n8nApiKey'> & {
        n8nApiUrl: string;
        n8nApiKey: string;
    };
}
//# sourceMappingURL=session-state.d.ts.map