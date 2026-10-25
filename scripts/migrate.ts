import { openDatabase, migrate } from '../src/server/db/connection.js';
import { loadConfig } from '../src/server/config.js';
const db = openDatabase(loadConfig().databasePath);
try {
  migrate(db);
  console.log('Database migrations applied.');
} finally {
  db.sqlite.close();
}
