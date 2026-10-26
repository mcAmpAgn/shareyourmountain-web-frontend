export type SqlValue = string | number | null;
/** Persistence port: neither application services nor queries depend on a runtime driver. */
export interface SqlDatabase {
  prepare(query: string): {
    all(...parameters: SqlValue[]): Promise<unknown[]>;
    get(...parameters: SqlValue[]): Promise<unknown | undefined>;
  };
}
