import type { CatalogItem } from '../../shared/contracts';
import type { AdventuresState } from '../hooks/use-adventures';
import { detailPath } from '../lib/detail-navigation';
import { DetailContent } from './DetailContent';
export function DetailPage({
  target,
  adventures,
}: {
  target: Pick<CatalogItem, 'kind' | 'id'>;
  adventures: AdventuresState;
}) {
  const list = target.kind === 'mountain' ? '/mountains' : '/routes';
  return (
    <section className="detail-page-container" aria-labelledby="detail-title">
      <nav className="detail-page-nav" aria-label="Percorso della scheda">
        <a href="/">Home</a>
        <span>/</span>
        <a href={list}>{target.kind === 'mountain' ? 'Montagne' : 'Itinerari'}</a>
        <a className="detail-back" href={list}>
          ← Torna all’archivio
        </a>
      </nav>
      <article className="detail-dialog detail-page">
        <DetailContent
          target={target}
          adventures={adventures}
          fullPage
          onOpen={(item) => {
            location.href = detailPath(item.kind, item.id);
          }}
        />
      </article>
    </section>
  );
}
