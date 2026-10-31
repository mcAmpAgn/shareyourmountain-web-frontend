import test from 'node:test';
import assert from 'node:assert/strict';
import { detailPath, detailTarget } from '../src/client/lib/detail-navigation.js';

test('dedicated details distinguish lists from records and reject malformed IDs', () => {
  assert.deepEqual(detailTarget('/mountains/10'), { kind: 'mountain', id: 10 });
  assert.deepEqual(detailTarget('/routes/2/'), { kind: 'route', id: 2 });
  assert.equal(detailPath('mountain', 10), '/mountains/10');
  assert.equal(detailPath('route', 2), '/routes/2');
  for (const path of [
    '/mountains',
    '/routes',
    '/mountains/0',
    '/mountains/-1',
    '/routes/2/photos',
    '/mountains/2147483648',
    '/routes/not-an-id',
    '/mountains/1.5',
  ])
    assert.equal(detailTarget(path), null);
});
