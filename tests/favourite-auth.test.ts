import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareFavouriteSignIn, takeFavouriteSignIn } from '../src/client/lib/favourite-auth.js';

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
test('login returns require a matching, unexpired same-tab favourite intent and consume it once', () => {
  const data = storage(),
    target = { kind: 'mountain' as const, targetId: 10 };
  const href = 'https://example.test/?resumeFavorite=1#detail=m-10';
  assert.equal(takeFavouriteSignIn(data, href, 1000), null);
  prepareFavouriteSignIn(data, target, 1000);
  assert.deepEqual(takeFavouriteSignIn(data, href, 1001), target);
  assert.equal(takeFavouriteSignIn(data, href, 1002), null);
  prepareFavouriteSignIn(data, target, 1000);
  assert.equal(takeFavouriteSignIn(data, href.replace('m-10', 'm-11'), 1001), null);
  prepareFavouriteSignIn(data, target, 1000);
  assert.equal(takeFavouriteSignIn(data, href, 601001), null);
  prepareFavouriteSignIn(data, target, 1000);
  assert.equal(takeFavouriteSignIn(data, href.replace('?resumeFavorite=1', ''), 1001), null);
  data.setItem('sym:favourite-sign-in', '{broken');
  assert.equal(takeFavouriteSignIn(data, href, 1001), null);
  data.setItem(
    'sym:favourite-sign-in',
    JSON.stringify({ kind: 'mountain', targetId: -1, expiresAt: 2000 }),
  );
  assert.equal(takeFavouriteSignIn(data, href, 1001), null);
});

test('blocked browser storage does not fabricate a saved intent', () => {
  const blocked = {
    getItem: () => {
      throw Error('blocked');
    },
    setItem: () => {
      throw Error('blocked');
    },
    removeItem: () => {
      throw Error('blocked');
    },
  };
  assert.equal(prepareFavouriteSignIn(blocked, { kind: 'route', targetId: 2 }), false);
  assert.equal(
    takeFavouriteSignIn(blocked, 'https://example.test/?resumeFavorite=1#detail=r-2'),
    null,
  );
});
