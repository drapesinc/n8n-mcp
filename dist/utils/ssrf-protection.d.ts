export declare class SSRFProtection {
    private static isPrivateOrMappedIpv6;
    static validateWebhookUrl(urlString: string): Promise<{
        valid: boolean;
        reason?: string;
    }>;
    static validateUrlSync(urlString: string): {
        valid: boolean;
        reason?: string;
    };
}
//# sourceMappingURL=ssrf-protection.d.ts.map