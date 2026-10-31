import { useEffect, useState } from 'react';
import type { CatalogItem, CatalogQuery, Filters, ItemKind } from '../../shared/contracts';
import type { AdventuresState } from '../hooks/use-adventures';
import { useResource } from '../hooks/use-resource';
import { api } from '../lib/api';
import { formatNumber } from '../lib/presentation';
import { CatalogFilters } from './CatalogFilters';

const metres = (value: number | null | undefined) =>
  value == null ? '—' : formatNumber(value) + ' m';
const distance = (value: number | null | undefined) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(value / 1000) + ' km';
export function CatalogTablePage({
  kind,
  query,
  options,
  onChange,
  onReset,
  onOpen,
  adventures,
}: {
  kind: ItemKind;
  query: CatalogQuery;
  options: Filters | null;
  onChange: (query: Partial<CatalogQuery>) => void;
  onReset: () => void;
  onOpen: (item: Pick<CatalogItem, 'kind' | 'id'>) => void;
  adventures: AdventuresState;
}) {
  const mountain = kind === 'mountain';
  useEffect(() => {
    document.title = `${mountain ? 'Montagne' : 'Itinerari'} — Share Your Mountain`;
  }, [mountain]);
  const [search, setSearch] = useState(query.q ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    setSearch(query.q ?? '');
  }, [query.q]);
  const result = useResource(
    (signal) => api.catalog({ ...query, kind, pageSize: 25 }, signal),
    [JSON.stringify(query), kind],
  );
  const filtersCount = [
    query.rangeId,
    query.groupId,
    query.countryId,
    query.regionId,
    query.minElevation,
    query.activityId,
    query.mountainId,
  ].filter((v) => v !== undefined).length;
  const columns = mountain
    ? ['Montagna', 'Quota', 'Catena montuosa', 'Gruppo montuoso', 'Paesi', 'Itinerari', 'Salva']
    : [
        'Itinerario',
        'Attività / difficoltà',
        'Quota',
        'Lunghezza / dislivello',
        'Montagna',
        'Catena / gruppo',
        'Regione / paese',
        'Salva',
      ];
  return (
    <section className="catalog-page wrapper" aria-labelledby="catalog-page-title" id="explore">
      <a className="catalog-breadcrumb" href="/">
        Home <span>/</span> Archivio <span>/</span> {mountain ? 'Montagne' : 'Itinerari'}
      </a>
      <div className="catalog-page-heading">
        <div>
          <p className="eyebrow">L’ARCHIVIO DELLA NOSTRA PASSIONE</p>
          <h1 id="catalog-page-title">
            {mountain ? 'Ogni cima, una storia.' : 'Il prossimo passo è qui.'}
          </h1>
          <p>
            {mountain
              ? 'Esplora le montagne, confronta le quote e trova il tuo prossimo orizzonte.'
              : 'Confronta attività, difficoltà e percorsi. Trova la tua prossima avventura.'}
          </p>
        </div>
        <a className="catalog-other" href={mountain ? '/routes' : '/mountains'}>
          {mountain ? 'Esplora gli itinerari' : 'Esplora le montagne'} ↗
        </a>
      </div>
      <nav className="catalog-page-tabs" aria-label="Sezioni dell’archivio">
        <a href="/mountains" aria-current={mountain ? 'page' : undefined}>
          ↟ &nbsp; Montagne
        </a>
        <a href="/routes" aria-current={!mountain ? 'page' : undefined}>
          ⌁ &nbsp; Itinerari
        </a>
        <a href="/soiusa">Gruppi e catene</a>
        <span>ARCHIVIO STORICO · 2017</span>
      </nav>
      <div className="catalog-table-toolbar">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            onChange({ q: search.trim() || undefined });
          }}
        >
          <label className="sr-only" htmlFor="table-search">
            Cerca {mountain ? 'montagne' : 'itinerari'}
          </label>
          <span aria-hidden="true">⌕</span>
          <input
            id="table-search"
            type="search"
            value={search}
            maxLength={120}
            placeholder={
              mountain
                ? 'Cerca una montagna, una catena, un paese…'
                : 'Cerca un itinerario, una zona…'
            }
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit">Cerca ↗</button>
        </form>
        <button
          className="filter-button"
          aria-controls="table-filters"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          ☷ &nbsp; Filtri {filtersCount ? `(${filtersCount})` : ''}
        </button>
        <label className="table-sort">
          Ordina{' '}
          <select
            aria-label="Ordina l’archivio"
            value={query.sort ?? 'name'}
            onChange={(e) => onChange({ sort: e.target.value as 'name' | 'elevation' })}
          >
            <option value="name">Nome A–Z</option>
            <option value="elevation">Quota decrescente</option>
          </select>
        </label>
      </div>
      {filtersOpen && (
        <div id="table-filters" className="table-filters">
          <CatalogFilters
            hideSearch
            query={query}
            options={options}
            onChange={onChange}
            onReset={onReset}
          />
          {!mountain && (
            <label className="activity-filter-label">
              Attività
              <select
                value={query.activityId ?? ''}
                onChange={(e) =>
                  onChange({ activityId: e.target.value ? Number(e.target.value) : undefined })
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
          )}
        </div>
      )}
      {query.groupId && (
        <p className="table-context">
          Gruppo montuoso: {result.data?.items[0]?.mountainGroup || `#${query.groupId}`}{' '}
          <button className="table-link" onClick={() => onChange({ groupId: undefined })}>
            Mostra tutti ×
          </button>{' '}
          · <a href="/soiusa">Gruppi e catene ↗</a>
        </p>
      )}
      {query.mountainId && (
        <p className="table-context">
          Itinerari collegati a{' '}
          {result.data?.items[0]?.parentMountain || 'una montagna selezionata'}{' '}
          <button className="table-link" onClick={() => onChange({ mountainId: undefined })}>
            Mostra tutti ×
          </button>
        </p>
      )}
      <div className="table-status" role="status">
        <span>
          {result.loading ? (
            'Ricerca nell’archivio…'
          ) : result.data ? (
            <>
              <strong>{formatNumber(result.data.total)}</strong>{' '}
              {mountain ? 'montagne' : 'itinerari'}
              {query.q ? ` per “${query.q}”` : ''}
            </>
          ) : (
            'Archivio non disponibile'
          )}
        </span>
        <span>25 risultati per pagina</span>
      </div>
      {adventures.error && (
        <p className="notice" role="alert">
          {adventures.error}
        </p>
      )}
      {result.error ? (
        <div className="empty-state" role="alert">
          <h2>L’archivio non è disponibile.</h2>
          <p>{result.error}</p>
          <button className="button" onClick={result.retry}>
            Riprova
          </button>
        </div>
      ) : result.loading ? (
        <div className="table-loading" aria-busy="true">
          Stiamo sfogliando l’archivio…
        </div>
      ) : !result.data?.items.length ? (
        <div className="empty-state">
          <h2>Nessun risultato con questi filtri.</h2>
          <p>Prova un altro nome o riparti dall’archivio completo.</p>
          <button className="button" onClick={onReset}>
            Azzera filtri ↺
          </button>
        </div>
      ) : (
        <>
          <div
            className="catalog-table-scroll"
            role="region"
            aria-label={
              mountain
                ? 'Tabella delle montagne, scorri per tutte le colonne'
                : 'Tabella degli itinerari, scorri per tutte le colonne'
            }
            tabIndex={0}
          >
            <table className="catalog-table">
              <caption className="sr-only">
                {mountain ? 'Montagne' : 'Itinerari'} · pagina {result.data.page} di{' '}
                {result.data.pages}
              </caption>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((item) => (
                  <tr key={item.key}>
                    <th scope="row">
                      <button className="table-name" onClick={() => onOpen(item)}>
                        {item.name}
                        <span aria-hidden="true">↗</span>
                      </button>
                      <small className="table-record">
                        {mountain ? 'CIMA' : 'ITINERARIO'} #{item.id}
                      </small>
                    </th>
                    {!mountain && (
                      <td>
                        <span
                          className="table-activity activity-label"
                          data-activity={item.activityId ?? undefined}
                        >
                          {item.activity || '—'}
                        </span>
                        <small>{item.difficultyRaw || 'Difficoltà non indicata'}</small>
                      </td>
                    )}
                    <td className="table-elevation">{metres(item.elevationM)}</td>
                    {mountain ? (
                      <>
                        <td>{item.range || '—'}</td>
                        <td>{item.mountainGroup || '—'}</td>
                        <td>{item.countries.join(' · ') || '—'}</td>
                        <td>
                          <button
                            className="table-link"
                            disabled={!item.routeCount}
                            onClick={() => {
                              location.href = '/routes?mountainId=' + item.id;
                            }}
                          >
                            {item.routeCount} itinerari ↗
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          {distance(item.lengthM)}
                          <small>↗ {metres(item.heightM)}</small>
                        </td>
                        <td>
                          {item.mountainId && item.parentMountain ? (
                            <button
                              className="table-link"
                              onClick={() => onOpen({ kind: 'mountain', id: item.mountainId! })}
                            >
                              {item.parentMountain}
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {item.range || '—'}
                          <small>{item.mountainGroup || '—'}</small>
                        </td>
                        <td>
                          {item.region || '—'}
                          <small>{item.countries.join(' · ') || '—'}</small>
                        </td>
                      </>
                    )}
                    <td>
                      <button
                        className={`table-save ${adventures.saved(item) ? 'is-saved' : ''}`}
                        aria-label={`${adventures.saved(item) ? 'Rimuovi' : 'Salva'} ${item.name}`}
                        aria-pressed={!!adventures.saved(item)}
                        disabled={adventures.pending || adventures.loading}
                        onClick={() => void adventures.toggle(item)}
                      >
                        {adventures.saved(item) ? '♥' : '♡'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <span>
              {formatNumber((result.data.page - 1) * result.data.pageSize + 1)}–
              {formatNumber(Math.min(result.data.page * result.data.pageSize, result.data.total))}{' '}
              di {formatNumber(result.data.total)}
            </span>
            <div>
              <button
                className="secondary-button"
                disabled={result.data.page <= 1}
                onClick={() => onChange({ page: result.data!.page - 1 })}
              >
                ← Precedenti
              </button>
              <span>
                Pagina {result.data.page} / {result.data.pages}
              </span>
              <button
                className="secondary-button"
                disabled={result.data.page >= result.data.pages}
                onClick={() => onChange({ page: result.data!.page + 1 })}
              >
                Successivi →
              </button>
            </div>
          </div>
        </>
      )}
      <p className="archive-note">
        Archivio del 28 dicembre 2017 · “—” indica un dato non presente. Quote, difficoltà e
        relazioni sono dati storici: verifica condizioni e fonti prima di partire.
      </p>
    </section>
  );
}
