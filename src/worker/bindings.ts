import type { D1Database } from '@cloudflare/workers-types';
export interface WorkerEnv {
  DB: D1Database;
  ASSETS: { fetch(input: string, init?: RequestInit): Promise<Response> };
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ACCESS_LOGIN_PROVIDER?: string;
}
