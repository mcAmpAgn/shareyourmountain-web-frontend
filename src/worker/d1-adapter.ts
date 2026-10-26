import type { D1Database } from '@cloudflare/workers-types';
import type { SqlDatabase } from '../core/sql.js';
export function d1Queries(db: D1Database): SqlDatabase {
  return {
    prepare(query) {
      return {
        all: async (...params) =>
          (
            await db
              .prepare(query)
              .bind(...params)
              .all()
          ).results,
        get: async (...params) =>
          (await db
            .prepare(query)
            .bind(...params)
            .first()) ?? undefined,
      };
    },
  };
}
