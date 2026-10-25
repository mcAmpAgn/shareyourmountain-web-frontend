import path from 'node:path';
import { z } from 'zod';
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const port = z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .parse(env.PORT ?? 8787);
  return {
    port,
    host: env.HOST ?? '127.0.0.1',
    databasePath: path.resolve(env.DATABASE_PATH ?? 'data/shareyourmountain.sqlite'),
    production: env.NODE_ENV === 'production',
  };
}
