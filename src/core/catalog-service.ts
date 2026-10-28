import type { CatalogRepository } from './catalog-repository.js';
import type { CatalogDetail, ItemKind } from '../shared/contracts.js';
export function safeURL(value: string | null | undefined, base?: string | null): string | null {
  if (!value) return null;
  try {
    const url = base ? new URL(value, base) : new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function createCatalogService(repository: CatalogRepository) {
  return {
    list: repository.list,
    suggestions: repository.suggestions,
    initialized: repository.initialized,
    stats: repository.stats,
    filters: repository.filters,
    map: repository.map,
    async detail(kind: ItemKind, id: number): Promise<CatalogDetail | null> {
      const item = await repository.get(kind, id);
      if (!item) return null;
      const raw = await (kind === 'route' ? repository.rawRoute(id) : repository.rawMountain(id));
      const [parent, description, sources, images, related, parking, track] = await Promise.all([
        item.mountainId ? repository.get('mountain', item.mountainId) : null,
        kind === 'mountain' ? repository.descriptions(id) : null,
        kind === 'route' ? repository.sources(id) : [],
        repository.images(kind, id),
        kind === 'mountain'
          ? repository.list({ kind: 'route', mountainId: id, pageSize: 50 })
          : null,
        raw?.parking_id ? repository.parking(Number(raw.parking_id)) : null,
        raw?.trackgps_id ? repository.track(Number(raw.trackgps_id)) : null,
      ]);
      return {
        ...item,
        description:
          description?.description ??
          (kind === 'mountain' ? String(raw?.mntn_description ?? '') || null : null),
        lengthM: kind === 'route' ? Number(raw?.route_length) || null : null,
        heightM: kind === 'route' ? Number(raw?.route_height) || null : null,
        lengthDescription: kind === 'route' ? String(raw?.route_lengthDescr ?? '') || null : null,
        sources:
          kind === 'route'
            ? sources.map((source) => ({
                name: source.name ?? 'Fonte originale',
                url: safeURL(source.path, source.base),
                originalPath: source.path,
              }))
            : description?.url
              ? [
                  {
                    name: 'Wikipedia / DBpedia',
                    url: safeURL(description.url),
                    originalPath: description.url,
                  },
                ]
              : [],
        images: images.flatMap((image) => {
          const url = image.image_cdn
            ? safeURL(
                'https://res.cloudinary.com/shareyourmountain/image/upload/' +
                  image.image_url.split('/').map(encodeURIComponent).join('/'),
              )
            : safeURL(image.image_url);
          return url ? [{ url, description: image.image_descr }] : [];
        }),
        relatedRoutes: related?.items ?? [],
        mountainLocation:
          parent?.latitude != null && parent.longitude != null
            ? { latitude: parent.latitude, longitude: parent.longitude }
            : null,
        parking: parking ?? null,
        track: track ? { name: track.name, url: safeURL(track.url) } : null,
      };
    },
  };
}
