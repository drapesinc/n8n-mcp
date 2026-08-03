import { NodeRepository } from '../database/node-repository';
export interface CommunityStats {
    total: number;
    verified: number;
    unverified: number;
}
export interface SyncResult {
    verified: {
        fetched: number;
        saved: number;
        skipped: number;
        errors: string[];
    };
    npm: {
        fetched: number;
        saved: number;
        skipped: number;
        nodesSaved: number;
        nodesRemoved: number;
        errors: string[];
    };
    duration: number;
}
export interface SyncOptions {
    verifiedOnly?: boolean;
    npmLimit?: number;
    skipExisting?: boolean;
    environment?: 'production' | 'staging';
}
export declare class CommunityNodeService {
    private fetcher;
    private repository;
    constructor(repository: NodeRepository, environment?: 'production' | 'staging');
    syncCommunityNodes(options?: SyncOptions, progressCallback?: (message: string, current: number, total: number) => void): Promise<SyncResult>;
    syncVerifiedNodes(progressCallback?: (message: string, current: number, total: number) => void, skipExisting?: boolean): Promise<SyncResult['verified']>;
    syncNpmNodes(limit?: number, progressCallback?: (message: string, current: number, total: number) => void, skipExisting?: boolean): Promise<SyncResult['npm']>;
    private strapiNodeToParsedNode;
    private npmPackageToParsedNodes;
    private matchesRole;
    private extractOperations;
    private rowsOutOfSync;
    private staleCommunityRows;
    private pruneStaleCommunityRows;
    private carryOverPackageDocs;
    private resolveNpmNodeNames;
    private extractNodeNameFromPackage;
    getCommunityStats(): CommunityStats;
    deleteCommunityNodes(): number;
}
//# sourceMappingURL=community-node-service.d.ts.map