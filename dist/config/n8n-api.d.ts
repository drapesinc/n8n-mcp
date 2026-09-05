export declare function getN8nApiConfig(): {
    baseUrl: string;
    apiKey: string;
    timeout: number;
    maxRetries: number;
    cfClientId: string | undefined;
    cfClientSecret: string | undefined;
} | null;
export declare function isN8nApiConfigured(): boolean;
export declare function getN8nApiConfigFromContext(context: {
    n8nApiUrl?: string;
    n8nApiKey?: string;
    n8nApiTimeout?: number;
    n8nApiMaxRetries?: number;
}): N8nApiConfig | null;
export type N8nApiConfig = NonNullable<ReturnType<typeof getN8nApiConfig>>;
export declare function isValidMcpAccessToken(token: unknown): token is string;
export declare function deriveOfficialMcpEndpoint(instanceUrl: string): string;
export interface OfficialMcpConfig {
    endpoint: string;
    token: string;
}
export declare function getOfficialMcpConfigFromContext(context: {
    n8nApiUrl?: string;
    n8nMcpAccessToken?: string;
}): OfficialMcpConfig | null;
export declare function getOfficialMcpConfig(): OfficialMcpConfig | null;
export declare function isOfficialMcpConfigured(): boolean;
//# sourceMappingURL=n8n-api.d.ts.map