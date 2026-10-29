import type { D1Database } from '@cloudflare/workers-types';
export interface WorkerEnv {
  DB: D1Database;
  ASSETS: { fetch(input: string, init?: RequestInit): Promise<Response> };
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ACCESS_LOGIN_PROVIDER?: string;
  INSTAGRAM_ACCESS_TOKEN?: string;
  INSTAGRAM_USER_ID?: string;
  INSTAGRAM_API_VERSION?: string;
  INSTAGRAM_MOUNTAIN_HASHTAGS?: string;
}
