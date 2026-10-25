import type { CatalogItem } from '../../shared/contracts';
export const formatNumber = (n: number) =>
  new Intl.NumberFormat('it-IT', { useGrouping: 'always' }).format(n);
export function landscape(item: CatalogItem) {
  return item.key === 'm-10'
    ? { file: 'cervino.jpg', alt: 'Cervino', illustrative: false }
    : item.range.includes('Dolomiti')
      ? { file: 'dolomites.jpg', alt: 'Paesaggio delle Dolomiti', illustrative: true }
      : item.kind === 'route'
        ? { file: 'climbing.jpg', alt: 'Paesaggio alpino', illustrative: true }
        : item.key === 'm-1330'
          ? { file: 'hiking.jpg', alt: 'Escursionista lungo una cresta alpina', illustrative: true }
          : { file: 'alps.jpg', alt: 'Paesaggio alpino', illustrative: true };
}
export function mapURL(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=13/${lat}/${lng}`;
}
