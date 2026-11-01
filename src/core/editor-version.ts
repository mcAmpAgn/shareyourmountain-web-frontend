import { ApplicationError } from './adventure-service.js';
export async function editorETag(record: unknown) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(record)),
  );
  return (
    '"' + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('') + '"'
  );
}
export async function checkEditorVersion(record: unknown, ifMatch: string | null | undefined) {
  if (!ifMatch)
    throw new ApplicationError(428, 'Leggi prima la versione corrente e invia If-Match.');
  if (ifMatch !== (await editorETag(record)))
    throw new ApplicationError(412, 'La scheda è cambiata. Rileggila prima di salvare.');
}
