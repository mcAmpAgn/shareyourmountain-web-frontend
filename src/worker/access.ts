import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { WorkerEnv } from './bindings.js';
import { ApplicationError } from '../core/adventure-service.js';
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export function accessConfigured(env: WorkerEnv) {
  return !!env.ACCESS_TEAM_DOMAIN && !!env.ACCESS_AUD;
}
export function accessIssuer(domain: string) {
  const url = new URL(domain.startsWith('https://') ? domain : 'https://' + domain);
  if (
    url.protocol !== 'https:' ||
    !/^[-a-z0-9]+\.cloudflareaccess\.com$/i.test(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new ApplicationError(503, 'Access non è configurato correttamente.');
  return url.origin;
}
/** Never trust an email header or an unverified JWT payload as a profile identity. */
export async function verifyAccessIdentity(
  request: Request,
  env: WorkerEnv,
  key?: JWTVerifyGetKey,
): Promise<string> {
  if (!accessConfigured(env))
    throw new ApplicationError(
      503,
      'Il catalogo è pubblico. I preferiti online richiedono la configurazione di Cloudflare Access.',
    );
  const issuer = accessIssuer(env.ACCESS_TEAM_DOMAIN!);
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16384)
    throw new ApplicationError(401, 'Accedi con Cloudflare Access per salvare le tue avventure.');
  try {
    if (!key) {
      if (!keySets.has(issuer))
        keySets.set(issuer, createRemoteJWKSet(new URL(issuer + '/cdn-cgi/access/certs')));
      key = keySets.get(issuer)!;
    }
    const { payload } = await jwtVerify(token, key, {
      issuer,
      audience: env.ACCESS_AUD!,
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp', 'iat', 'iss', 'aud'],
      clockTolerance: 5,
    });
    if (typeof payload.sub !== 'string' || !payload.sub.trim()) throw Error('Missing subject');
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(issuer + '\0' + payload.sub),
    );
    return (
      'access:' +
      Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    );
  } catch {
    throw new ApplicationError(401, 'Sessione non valida o scaduta. Accedi di nuovo.');
  }
}
