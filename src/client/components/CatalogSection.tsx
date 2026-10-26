import { useState } from 'react';
import type { CatalogItem, CatalogQuery, CatalogPage, Filters } from '../../shared/contracts';
import { api } from '../lib/api';
import { formatNumber } from '../lib/presentation';
import { useResource } from '../hooks/use-resource';
import type { AdventuresState } from '../hooks/use-adventures';
import { CatalogCard } from './CatalogCard';
import { CatalogFilters } from './CatalogFilters';
export function CatalogSection({
  query,
  featured,
  options,
  adventures,
  onChange,
  onReset,
  onOpen,
  onFeatured,
}: {
  query: CatalogQuery;
  featured: boolean;
  options: Filters | null;
  adventures: AdventuresState;
  onChange: (change: Partial<CatalogQuery>) => void;
  onReset: () => void;
  onOpen: (item: CatalogItem) => void;
  onFeatured: () => void;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const result = useResource<CatalogPage>(
    async (signal) => {
      if (!featured) return api.catalog(query, signal);
      const settled = await Promise.all(
        [10, 1240, 1330].map((id) => api.detail('mountain', id, signal).catch(() => null)),
      );
      const items = settled.filter((item): item is NonNullable<typeof item> => item !== null);
      return items.length
        ? { items, total: items.length, page: 1, pageSize: 3, pages: 1 }
        : api.catalog({ kind: 'mountain', sort: 'elevation', pageSize: 3 }, signal);
    },
    [JSON.stringify(query), featured],
  );
  return (
    <section id="explore" className="explore wrapper section-space" aria-labelledby="explore-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">IL RICHIAMO DELLA MONTAGNA</p>
          <h2 id="explore-title">Qual è la tua prossima meta?</h2>
          <p className="section-description">
            Grandi classici e piccoli tesori. Scegli da dove partire.
          </p>
        </div>
        <button className="text-button" onClick={onReset}>
          Esplora tutto l’archivio <span>↗</span>
        </button>
      </div>
      <div className="explore-toolbar">
        <div className="tabs" aria-label="Filtra l’archivio">
          <button className={featured ? 'active' : ''} aria-pressed={featured} onClick={onFeatured}>
            Per ispirarti
          </button>
          {(['mountain', 'route'] as const).map((kind) => (
            <button
              key={kind}
              className={!featured && query.kind === kind && !query.activityId ? 'active' : ''}
              aria-pressed={!featured && query.kind === kind && !query.activityId}
              onClick={() => onChange({ kind, activityId: undefined })}
            >
              {kind === 'mountain' ? 'Cime e montagne' : 'Itinerari'}
            </button>
          ))}
        </div>
        <button
          className="filter-button"
          aria-expanded={showFilters}
          aria-controls="catalog-filters"
          onClick={() => setShowFilters(!showFilters)}
        >
          <span aria-hidden="true">☷</span> Filtri
        </button>
      </div>
      {showFilters && (
        <div id="catalog-filters">
          <CatalogFilters query={query} options={options} onChange={onChange} onReset={onReset} />
          <label className="activity-filter-label">
            Attività
            <select
              value={query.activityId ?? ''}
              onChange={(event) =>
                onChange({
                  activityId: event.target.value ? Number(event.target.value) : undefined,
                  kind: event.target.value ? 'route' : query.kind,
                })
              }
            >
              <option value="">Tutte le attività</option>
              {options?.activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <p className="results-info" role="status">
        {result.loading
          ? 'Ricerca nell’archivio…'
          : result.data && !featured
            ? `${formatNumber(result.data.total)} risultati${query.q ? ' per “' + query.q + '”' : ''} · archivio 2017`
            : ''}
      </p>
      {adventures.error && (
        <p className="notice" role="alert">
          {adventures.error}
        </p>
      )}
      {result.error ? (
        <div className="empty-state" role="alert">
          <h3>L’archivio non è disponibile.</h3>
          <p>{result.error}</p>
          <button className="button" onClick={result.retry}>
            Riprova
          </button>
        </div>
      ) : (
        <div className="cards" aria-busy={result.loading}>
          {result.loading ? (
            <p className="muted">Stiamo cercando il tuo prossimo orizzonte…</p>
          ) : result.data?.items.length ? (
            result.data.items.map((item) => (
              <CatalogCard
                key={item.key}
                item={item}
                saved={!!adventures.saved(item)}
                pending={adventures.pending || adventures.loading || !adventures.canSave}
                onSave={() => void adventures.toggle(item)}
                onOpen={() => onOpen(item)}
              />
            ))
          ) : (
            <div className="empty-state">
              <h3>Un nuovo orizzonte ti aspetta.</h3>
              <p>
                Nessun risultato con questi filtri. Prova un’altra zona o esplora tutto l’archivio.
              </p>
              <button className="button" onClick={onReset}>
                Esplora l’archivio ↗
              </button>
            </div>
          )}
        </div>
      )}
      {result.data && result.data.pages > 1 && (
        <div className="pagination">
          <button
            className="secondary-button"
            disabled={result.data.page === 1}
            onClick={() => onChange({ page: result.data!.page - 1 })}
          >
            ← Precedenti
          </button>
          <span>
            {result.data.page} / {result.data.pages}
          </span>
          <button
            className="secondary-button"
            disabled={result.data.page === result.data.pages}
            onClick={() => onChange({ page: result.data!.page + 1 })}
          >
            Successivi →
          </button>
        </div>
      )}
      <p className="archive-note">
        ↗ Archivio storico del 28 dicembre 2017. Le foto nelle anteprime sono illustrative, salvo
        dove indicato. Verifica sempre relazioni e condizioni aggiornate prima di partire.
      </p>
    </section>
  );
}
