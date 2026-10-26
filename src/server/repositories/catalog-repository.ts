import type { AppDatabase } from '../db/connection.js';
import { sqliteQueries } from '../db/query-adapter.js';
import { createCatalogRepository as createRepository } from '../../core/catalog-repository.js';
export type { CatalogRepository } from '../../core/catalog-repository.js';
export function createCatalogRepository(db: AppDatabase) {
  return createRepository(sqliteQueries(db));
}
