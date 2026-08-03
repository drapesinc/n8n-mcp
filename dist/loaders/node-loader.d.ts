export interface LoadedNode {
    packageName: string;
    nodeName: string;
    NodeClass: any;
}
export declare class N8nNodeLoader {
    private readonly CORE_PACKAGES;
    loadAllNodes(): Promise<LoadedNode[]>;
    private resolvePackageDir;
    private loadNodeModule;
    private loadNodeModuleWithStubbedDependencies;
    private resolveNodeClass;
    private loadPackageNodes;
}
//# sourceMappingURL=node-loader.d.ts.map