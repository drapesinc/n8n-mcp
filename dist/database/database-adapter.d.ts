export interface DatabaseAdapter {
    prepare(sql: string): PreparedStatement;
    exec(sql: string): void;
    close(): void;
    pragma(key: string, value?: any): any;
    readonly inTransaction: boolean;
    transaction<T>(fn: () => T): T;
    checkFTS5Support(): boolean;
}
export interface PreparedStatement {
    run(...params: any[]): RunResult;
    get(...params: any[]): any;
    all(...params: any[]): any[];
    iterate(...params: any[]): IterableIterator<any>;
    pluck(toggle?: boolean): this;
    expand(toggle?: boolean): this;
    raw(toggle?: boolean): this;
    columns(): ColumnDefinition[];
    bind(...params: any[]): this;
}
export interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
}
export interface ColumnDefinition {
    name: string;
    column: string | null;
    table: string | null;
    database: string | null;
    type: string | null;
}
export declare function createDatabaseAdapter(dbPath: string): Promise<DatabaseAdapter>;
export declare function createSQLJSAdapter(dbPath: string): Promise<DatabaseAdapter>;
//# sourceMappingURL=database-adapter.d.ts.map