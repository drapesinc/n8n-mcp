import { URL } from 'url';
import http from 'http';
import https from 'https';
export interface PinnedAgents {
    httpAgent: http.Agent;
    httpsAgent: https.Agent;
}
export interface PinnedFetch {
    fetch: (url: string | URL, init?: RequestInit) => Promise<Response>;
    close(): Promise<void>;
}
export interface WebhookUrlValidationResult {
    valid: boolean;
    reason?: string;
    address?: string;
    family?: 4 | 6;
    addresses?: Array<{
        address: string;
        family: 4 | 6;
    }>;
}
export declare class SSRFProtection {
    private static isLoopbackHost;
    private static isPrivateOrMappedIpv6;
    private static tryExtractTunneledIPv4;
    private static firstHextet;
    private static hextetsToIPv4;
    private static tunneledIPv6BlockReason;
    static validateWebhookUrl(urlString: string): Promise<WebhookUrlValidationResult>;
    private static validateResolvedAddress;
    private static buildPinnedLookup;
    static createPinnedAgents(addresses: Array<{
        address: string;
        family: 4 | 6;
    }>): PinnedAgents;
    static createPinnedFetch(addresses: Array<{
        address: string;
        family: 4 | 6;
    }>): PinnedFetch;
    static validateUrlSync(urlString: string): {
        valid: boolean;
        reason?: string;
    };
}
//# sourceMappingURL=ssrf-protection.d.ts.map