import type { AppDatabase } from './connection.js';
import type { SqlDatabase } from '../../core/sql.js';
export function sqliteQueries(db: AppDatabase): SqlDatabase {
  return {
    prepare(query) {
      const statement = db.sqlite.prepare(query);
      return {
        all: async (...params) => statement.all(...params),
        get: async (...params) => statement.get(...params),
      };
    },
  };
}
