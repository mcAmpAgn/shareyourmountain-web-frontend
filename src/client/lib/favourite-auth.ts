import type { AdventureInput } from '../../shared/contracts';

const intentKey = 'sym:favourite-sign-in';
type IntentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** A same-tab, short-lived intent is required before a login return can save anything. */
export function prepareFavouriteSignIn(
  storage: IntentStorage,
  target: AdventureInput,
  now = Date.now(),
) {
  try {
    storage.setItem(intentKey, JSON.stringify({ ...target, expiresAt: now + 10 * 60_000 }));
    return true;
  } catch {
    return false;
  }
}

export function takeFavouriteSignIn(
  storage: IntentStorage,
  href: string,
  now = Date.now(),
): AdventureInput | null {
  try {
    const url = new URL(href);
    if (url.searchParams.get('resumeFavorite') !== '1') return null;
    const raw = storage.getItem(intentKey);
    storage.removeItem(intentKey);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      !value ||
      !['mountain', 'route'].includes(value.kind) ||
      !Number.isInteger(value.targetId) ||
      value.targetId <= 0 ||
      value.targetId > 2147483647 ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt < now ||
      value.expiresAt > now + 10 * 60_000
    )
      return null;
    if (url.hash !== `#detail=${value.kind === 'mountain' ? 'm' : 'r'}-${value.targetId}`)
      return null;
    return { kind: value.kind, targetId: value.targetId };
  } catch {
    return null;
  }
}
