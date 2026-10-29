import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMountainGallery,
  commonsPhotos,
  instagramPhotos,
} from '../src/core/mountain-gallery.js';
import { fixtureDatabase } from './fixtures.js';
import { createCatalogRepository } from '../src/server/repositories/catalog-repository.js';
const mountain = {
  id: 10,
  name: 'Cervino',
  wikipedia_url: 'https://it.wikipedia.org/wiki/Cervino',
};
const commonsResponse = {
  query: {
    pages: {
      42: {
        pageid: 42,
        title: 'File:Matterhorn.jpg',
        imageinfo: [
          {
            mime: 'image/jpeg',
            thumburl: 'https://thumb.wikimedia.org/photo.jpg',
            descriptionurl: 'https://commons.wikimedia.org/wiki/File:Matterhorn.jpg',
            extmetadata: {
              Artist: { value: '<a href="x">Alpine photographer</a>' },
              LicenseShortName: { value: 'CC BY-SA 4.0' },
              LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
              ImageDescription: { value: '<p>Cervino &amp; neve</p>' },
            },
          },
        ],
      },
    },
  },
};
test('Commons follows the exact Wikidata category, retains licence credit and caches/coalesces bounded requests', async () => {
  let calls = 0,
    now = 0;
  const service = createMountainGallery(
    {},
    (async (input: URL) => {
      calls++;
      if (input.hostname === 'www.wikidata.org') {
        assert.equal(input.searchParams.get('titles'), 'Cervino');
        assert.equal(input.searchParams.get('sites'), 'itwiki');
        return Response.json({
          entities: { Q1378: { sitelinks: { commonswiki: { title: 'Category:Matterhorn' } } } },
        });
      }
      assert.equal(input.hostname, 'commons.wikimedia.org');
      assert.equal(input.searchParams.get('gcmtitle'), 'Category:Matterhorn');
      return Response.json(commonsResponse);
    }) as typeof fetch,
    () => now,
  );
  const [first, second] = await Promise.all([
    service.load(mountain, 'commons'),
    service.load(mountain, 'commons'),
  ]);
  assert.deepEqual(first, second);
  assert.equal(calls, 2);
  assert.equal(first.status, 'ready');
  assert.equal(first.images[0].author, 'Alpine photographer');
  assert.equal(first.images[0].title, 'Cervino & neve');
  assert.equal(first.images[0].license, 'CC BY-SA 4.0');
  await service.load(mountain, 'commons');
  assert.equal(calls, 2);
  now = 3600001;
  await service.load(mountain, 'commons');
  assert.equal(calls, 4);
  const unsafe = structuredClone(commonsResponse);
  unsafe.query.pages[42].imageinfo[0].thumburl = 'https://evil.example/tracker';
  assert.deepEqual(commonsPhotos(unsafe), []);
  assert.deepEqual(
    commonsPhotos({ query: { pages: { 42: { imageinfo: [{ mime: 'image/svg+xml' }] } } } }),
    [],
  );
});
test('representative photos precede category files, use current Wikimedia thumbnails and deduplicate', async () => {
  const category = {
    query: {
      pages: {
        42: commonsResponse.query.pages[42],
        43: { ...commonsResponse.query.pages[42], pageid: 43 },
      },
    },
  };
  const client = createMountainGallery({}, (async (url: URL) => {
    if (url.hostname === 'www.wikidata.org')
      return Response.json({
        entities: {
          Q1378: {
            claims: { P18: [{ mainsnak: { datavalue: { value: 'Matterhorn.jpg' } } }] },
            sitelinks: { commonswiki: { title: 'Category:Matterhorn' } },
          },
        },
      });
    return Response.json(url.searchParams.has('titles') ? commonsResponse : category);
  }) as typeof fetch);
  const photos = await client.load(mountain, 'commons');
  assert.deepEqual(
    photos.images.map((photo) => photo.id),
    ['42', '43'],
  );
  assert.equal(new URL(photos.images[0].url).hostname, 'thumb.wikimedia.org');
});
test('Instagram uses an approved hashtag mapping and server-only Authorization, filters video and unsafe URLs', async () => {
  let calls = 0;
  const token = 'test-server-token';
  const payload = {
    data: [
      {
        id: '123',
        media_type: 'CAROUSEL_ALBUM',
        caption: 'Cervino',
        permalink: 'https://www.instagram.com/p/test/',
        children: {
          data: [
            {
              id: 'image',
              media_type: 'IMAGE',
              media_url: 'https://scontent.cdninstagram.com/image.jpg',
            },
            {
              id: 'video',
              media_type: 'VIDEO',
              media_url: 'https://scontent.cdninstagram.com/movie.mp4',
            },
          ],
        },
      },
    ],
  };
  const config = {
    instagramToken: token,
    instagramUserId: '1234',
    instagramVersion: 'v99.0',
    instagramHashtags: '{"10":"5678"}',
  };
  const service = createMountainGallery(config, (async (url: URL, init: RequestInit) => {
    calls++;
    assert.equal(url.hostname, 'graph.facebook.com');
    assert.equal(url.pathname, '/v99.0/5678/top_media');
    assert.ok(!url.href.includes(token));
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer ' + token);
    return Response.json(payload);
  }) as typeof fetch);
  const value = await service.load(mountain, 'instagram');
  assert.equal(value.status, 'ready');
  assert.equal(value.images.length, 1);
  assert.ok(!JSON.stringify(value).includes(token));
  assert.equal((await service.load({ ...mountain, id: 11 }, 'instagram')).status, 'not_configured');
  assert.equal(calls, 1);
  const unsafe = structuredClone(payload);
  unsafe.data[0].permalink = 'https://evil.example/post';
  assert.deepEqual(instagramPhotos(unsafe), []);
  assert.equal(
    (await createMountainGallery().load(mountain, 'instagram')).status,
    'not_configured',
  );
});
test('provider failures are generic, not cached and never leak raw provider errors', async () => {
  let calls = 0;
  const service = createMountainGallery({}, (async () => {
    calls++;
    throw Error('sensitive upstream URL/token');
  }) as typeof fetch);
  const first = await service.load(mountain, 'commons');
  assert.deepEqual(first, { provider: 'commons', status: 'unavailable', images: [] });
  await service.load(mountain, 'commons');
  assert.equal(calls, 2);
  const empty = createMountainGallery({}, (async () =>
    Response.json({ entities: { '-1': { missing: '' } } })) as typeof fetch);
  assert.equal((await empty.load(mountain, 'commons')).status, 'empty');
});
test('photo references read only active mountains and avoid full detail hydration', async () => {
  const db = fixtureDatabase();
  try {
    const repo = createCatalogRepository(db);
    assert.equal((await repo.photoReference(10))?.name, 'Cervino');
    assert.equal(await repo.photoReference(12), undefined);
    assert.equal(await repo.photoReference(999), undefined);
  } finally {
    db.sqlite.close();
  }
});
