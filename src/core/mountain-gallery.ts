import type { MountainGallery, MountainPhoto, PhotoProvider } from '../shared/contracts.js';
export interface MountainPhotoReference {
  id: number;
  name: string;
  wikipedia_url: string | null;
}
export interface InstagramGalleryConfig {
  instagramToken?: string;
  instagramUserId?: string;
  instagramVersion?: string;
  /** Curated mountain ID -> already resolved Instagram hashtag ID. Never search every mountain. */
  instagramHashtags?: string;
}
type Json = Record<string, any>;
const text = (value: unknown) =>
  typeof value === 'string'
    ? value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500)
    : '';
function safeLink(value: unknown, allowed: (host: string) => boolean) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && allowed(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
const commonsFile = (value: unknown) =>
  safeLink(value, (host) => ['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(host));
const commonsPage = (value: unknown) => safeLink(value, (host) => host === 'commons.wikimedia.org');
const licenseLink = (value: unknown) =>
  safeLink(value, (host) =>
    [
      'creativecommons.org',
      'www.creativecommons.org',
      'www.gnu.org',
      'gnu.org',
      'commons.wikimedia.org',
    ].includes(host),
  );
export function commonsPhotos(payload: Json): MountainPhoto[] {
  const pages = Object.values(payload.query?.pages ?? {}) as Json[];
  return pages
    .flatMap((page) => {
      const info = page.imageinfo?.[0],
        meta = info?.extmetadata ?? {};
      if (!info || !['image/jpeg', 'image/png', 'image/webp'].includes(info.mime)) return [];
      const url = commonsFile(info.thumburl ?? info.url),
        sourceUrl = commonsPage(info.descriptionurl),
        license = text(meta.LicenseShortName?.value);
      if (!url || !sourceUrl || !license) return [];
      return [
        {
          id: String(page.pageid),
          url,
          sourceUrl,
          title: text(meta.ImageDescription?.value) || text(page.title).replace(/^File:/, ''),
          author: text(meta.Artist?.value) || 'Autore indicato nella fonte',
          license,
          licenseUrl: licenseLink(meta.LicenseUrl?.value),
        },
      ];
    })
    .slice(0, 12);
}
export function instagramPhotos(payload: Json): MountainPhoto[] {
  return (Array.isArray(payload.data) ? payload.data : [])
    .flatMap((post: Json) => {
      const children = post.media_type === 'CAROUSEL_ALBUM' ? (post.children?.data ?? []) : [post];
      const sourceUrl = safeLink(post.permalink, (host) =>
        ['www.instagram.com', 'instagram.com'].includes(host),
      );
      if (!sourceUrl) return [];
      return children.flatMap((image: Json) => {
        const url = safeLink(
          image.media_url,
          (host) => host.endsWith('.cdninstagram.com') || host.endsWith('.fbcdn.net'),
        );
        return image.media_type === 'IMAGE' && url
          ? [
              {
                id: String(image.id ?? post.id),
                url,
                sourceUrl,
                title: text(post.caption) || 'Foto della community Instagram',
                author: 'Instagram',
                license: 'Diritti del rispettivo autore',
                licenseUrl: null,
              },
            ]
          : [];
      });
    })
    .slice(0, 9);
}
export function createMountainGallery(
  config: InstagramGalleryConfig = {},
  fetcher: typeof fetch = fetch,
  now = () => Date.now(),
) {
  const entries = new Map<string, { expires: number; value: MountainGallery }>();
  const pending = new Map<string, Promise<MountainGallery>>();
  const result = (
    provider: PhotoProvider,
    status: MountainGallery['status'],
    images: MountainPhoto[] = [],
  ): MountainGallery => ({ provider, status, images });
  async function json(url: URL, headers: HeadersInit = {}): Promise<Json> {
    const response = await fetcher(url, {
      headers: {
        'User-Agent':
          'ShareYourMountain/2.0 (https://github.com/mcAmpAgn/shareyourmountain-web-frontend)',
        ...headers,
      },
      signal: AbortSignal.timeout(7000),
      redirect: 'error',
    });
    if (!response.ok) throw Error('Photo provider unavailable');
    const body = (await response.json()) as Json;
    if (body.error) throw Error('Photo provider unavailable');
    return body;
  }
  async function commons(mountain: MountainPhotoReference) {
    let site = 'itwiki',
      title = mountain.name;
    try {
      const source = new URL(mountain.wikipedia_url ?? '');
      const language = source.hostname.match(/^(it|en|fr|de)\.wikipedia\.org$/)?.[1];
      if (language && source.pathname.startsWith('/wiki/')) {
        site = language + 'wiki';
        title = decodeURIComponent(source.pathname.slice(6)).replaceAll('_', ' ');
      }
    } catch {
      /* Match the catalog title when the historical source is missing. */
    }
    const entityUrl = new URL('https://www.wikidata.org/w/api.php');
    entityUrl.search = new URLSearchParams({
      action: 'wbgetentities',
      sites: site,
      titles: title,
      props: 'claims|sitelinks',
      sitefilter: 'commonswiki',
      format: 'json',
      redirects: 'yes',
    }).toString();
    const entities = (await json(entityUrl)).entities;
    const entity = Object.values(entities ?? {}).find((value: any) => !('missing' in value)) as
      Json | undefined;
    const commonsTitle = entity?.sitelinks?.commonswiki?.title;
    const category =
      typeof commonsTitle === 'string' && commonsTitle.startsWith('Category:')
        ? commonsTitle
        : entity?.claims?.P373?.[0]?.mainsnak?.datavalue?.value
          ? 'Category:' + entity.claims.P373[0].mainsnak.datavalue.value
          : null;
    const cover = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!category && typeof cover !== 'string') return result('commons', 'empty');
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata',
      iiurlwidth: '1200',
      iiextmetadatalanguage: 'it',
    });
    const requests: Promise<MountainPhoto[]>[] = [];
    const requestPhotos = async (parameters: URLSearchParams) => {
      const requestUrl = new URL(url);
      requestUrl.search = parameters.toString();
      return commonsPhotos(await json(requestUrl));
    };
    // The representative image is first; category order often starts with historical scans.
    if (typeof cover === 'string') {
      const representative = new URLSearchParams(params);
      representative.set('titles', 'File:' + cover);
      requests.push(requestPhotos(representative));
    }
    if (category) {
      const members = new URLSearchParams(params);
      members.set('generator', 'categorymembers');
      members.set('gcmtitle', category);
      members.set('gcmnamespace', '6');
      members.set('gcmtype', 'file');
      members.set('gcmlimit', '24');
      requests.push(requestPhotos(members));
    }
    const settled = await Promise.allSettled(requests);
    if (settled.every((request) => request.status === 'rejected'))
      throw Error('Photo provider unavailable');
    const unique = new Map<string, MountainPhoto>();
    for (const request of settled)
      if (request.status === 'fulfilled')
        for (const photo of request.value) if (!unique.has(photo.id)) unique.set(photo.id, photo);
    const photos = [...unique.values()].slice(0, 12);
    if (!photos.length && settled.some((request) => request.status === 'rejected'))
      throw Error('Photo provider unavailable');
    return result('commons', photos.length ? 'ready' : 'empty', photos);
  }
  async function instagram(mountain: MountainPhotoReference) {
    let hashtags: Record<string, unknown>;
    try {
      hashtags = JSON.parse(config.instagramHashtags ?? '{}');
    } catch {
      return result('instagram', 'not_configured');
    }
    const hashtag = hashtags?.[String(mountain.id)],
      version = config.instagramVersion;
    if (
      !config.instagramToken ||
      !/^\d+$/.test(config.instagramUserId ?? '') ||
      !/^v\d+\.\d+$/.test(version ?? '') ||
      typeof hashtag !== 'string' ||
      !/^\d+$/.test(hashtag)
    )
      return result('instagram', 'not_configured');
    const url = new URL(`https://graph.facebook.com/${version}/${hashtag}/top_media`);
    url.search = new URLSearchParams({
      user_id: config.instagramUserId!,
      fields: 'id,caption,media_type,media_url,permalink,children{id,media_type,media_url}',
      limit: '9',
    }).toString();
    const photos = instagramPhotos(
      await json(url, { Authorization: 'Bearer ' + config.instagramToken }),
    );
    return result('instagram', photos.length ? 'ready' : 'empty', photos);
  }
  return {
    async load(
      mountain: MountainPhotoReference,
      provider: PhotoProvider,
    ): Promise<MountainGallery> {
      const key = provider + ':' + mountain.id;
      const cached = entries.get(key);
      if (cached && cached.expires > now()) return cached.value;
      if (pending.has(key)) return pending.get(key)!;
      const task = (async () => {
        let value: MountainGallery;
        try {
          value = await (provider === 'commons' ? commons(mountain) : instagram(mountain));
        } catch {
          return result(provider, 'unavailable');
        }
        if (['ready', 'empty'].includes(value.status)) {
          while (entries.size >= 64) entries.delete(entries.keys().next().value!);
          entries.set(key, { value, expires: now() + (provider === 'commons' ? 3600000 : 300000) });
        }
        return value;
      })();
      pending.set(key, task);
      try {
        return await task;
      } finally {
        pending.delete(key);
      }
    },
  };
}
