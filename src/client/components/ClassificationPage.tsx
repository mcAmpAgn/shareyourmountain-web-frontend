import { RecordLabel } from './RecordLabel';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useResource } from '../hooks/use-resource';
import { classificationRows, filterClassification } from '../lib/classification';
import './classification.css';
const pageSize = 25;
function readState() {
  const p = new URLSearchParams(location.search);
  return {
    q: (p.get('q') ?? '').slice(0, 120),
    scope: p.get('scope') === 'all' ? 'all' : 'alpine',
    type: ['range', 'group'].includes(p.get('type') ?? '') ? p.get('type')! : 'all',
    rangeId: /^\d+$/.test(p.get('rangeId') ?? '') ? Number(p.get('rangeId')) : 0,
    page: Math.max(1, Math.min(10000, Math.floor(Number(p.get('page'))) || 1)),
  };
}
export function ClassificationPage() {
  const result = useResource((signal) => api.classification(signal), []);
  const [state, setState] = useState(readState);
  const rows = useMemo(() => (result.data ? classificationRows(result.data) : []), [result.data]);
  const filtered = useMemo(
    () => filterClassification(rows, state.q, state.scope, state.type, state.rangeId),
    [rows, state.q, state.scope, state.type, state.rangeId],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    page = Math.min(state.page, pages);
  function update(patch: Partial<typeof state>) {
    setState((previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }));
  }
  useEffect(() => {
    document.title = 'Gruppi e catene · SOIUSA — Share Your Mountain';
    const back = () => setState(readState());
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  useEffect(() => {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.scope !== 'alpine') p.set('scope', state.scope);
    if (state.type !== 'all') p.set('type', state.type);
    if (state.rangeId) p.set('rangeId', String(state.rangeId));
    if (state.page > 1) p.set('page', String(state.page));
    history.replaceState(null, '', '/soiusa' + (p.size ? '?' + p : '') + location.hash);
  }, [state]);
  const selected = result.data?.ranges.find((r) => r.id === state.rangeId);
  return (
    <section
      className="catalog-page wrapper classification-page"
      aria-labelledby="classification-title"
    >
      <a className="catalog-breadcrumb" href="/">
        Home <span>/</span> Atlante delle montagne
      </a>
      <div className="catalog-page-heading">
        <div>
          <p className="eyebrow">DALL’ARCO ALPINO AL SINGOLO GRUPPO</p>
          <h1 id="classification-title">Dai un nome al tuo orizzonte.</h1>
          <p>
            Cerca gruppi e catene montuose. Segui la gerarchia delle Alpi, poi scopri le cime e gli
            itinerari.
          </p>
        </div>
        <span className="classification-badge">ATLANTE / SOIUSA</span>
      </div>
      <nav className="catalog-page-tabs" aria-label="Sezioni dell’archivio">
        <a href="/mountains">Montagne</a>
        <a href="/routes">Itinerari</a>
        <a href="/soiusa" aria-current="page">
          Gruppi e catene
        </a>
      </nav>
      <div className="classification-guide">
        <div>
          <p className="eyebrow">COME LEGGERE IL PAESAGGIO</p>
          <p className="classification-flow">
            Alpi <span>→</span> Sezione <span>→</span> Sottosezione <span>→</span> Gruppi
          </p>
        </div>
        <p>
          La parte alpina dell’archivio deriva dalla SOIUSA. La gerarchia storica è parziale: codici
          ufficiali e livelli intermedi non sono disponibili. I gruppi mantengono i nomi originali
          del catalogo.{' '}
          <a
            href="https://webgis.arpa.piemonte.it/ags/rest/services/topografia_dati_di_base/SOIUSA/MapServer"
            target="_blank"
            rel="noreferrer"
          >
            Scopri la classificazione ↗
          </a>
        </p>
      </div>
      <div className="classification-controls" role="search" aria-label="Cerca gruppi e catene">
        <label className="classification-search">
          Cerca nell’atlante
          <input
            type="search"
            value={state.q}
            maxLength={120}
            placeholder="Dolomiti, Grigne, Alpi Pennine…"
            onChange={(e) => update({ q: e.target.value })}
          />
        </label>
        <label>
          Territorio
          <select
            value={state.scope}
            onChange={(e) => update({ scope: e.target.value, rangeId: 0 })}
          >
            <option value="alpine">Alpi · SOIUSA</option>
            <option value="all">Tutto l’archivio</option>
          </select>
        </label>
        <label>
          Raggruppamento
          <select value={state.type} onChange={(e) => update({ type: e.target.value })}>
            <option value="all">Catene e gruppi</option>
            <option value="range">Catene / sezioni</option>
            <option value="group">Gruppi montuosi</option>
          </select>
        </label>
        <button
          className="text-button"
          onClick={() => setState({ q: '', scope: 'alpine', type: 'all', rangeId: 0, page: 1 })}
        >
          Azzera filtri ↺
        </button>
      </div>
      {state.scope === 'all' && (
        <p className="classification-note">
          Appennini e altri sistemi montuosi sono mostrati come classificazione storica, fuori dalla
          SOIUSA.
        </p>
      )}
      {selected && (
        <div className="classification-selection">
          <span>
            All’interno di <strong>{selected.name}</strong>
          </span>
          <button className="text-button" onClick={() => update({ rangeId: 0 })}>
            Tutto l’atlante ×
          </button>
        </div>
      )}
      <div className="table-status" role="status">
        <span>
          {result.loading
            ? 'Apertura dell’atlante…'
            : `${filtered.length.toLocaleString('it-IT')} ${filtered.length === 1 ? 'raggruppamento' : 'raggruppamenti'}`}
        </span>
        <span>25 risultati per pagina</span>
      </div>
      {result.error ? (
        <div className="empty-state" role="alert">
          <h2>L’atlante non è disponibile.</h2>
          <p>{result.error}</p>
          <button className="button" onClick={result.retry}>
            Riprova
          </button>
        </div>
      ) : result.loading ? (
        <div className="table-loading" aria-busy="true">
          Caricamento della classificazione…
        </div>
      ) : !filtered.length ? (
        <div className="empty-state">
          <h2>Nessun raggruppamento trovato.</h2>
          <p>Prova un altro nome oppure seleziona tutto l’archivio.</p>
        </div>
      ) : (
        <>
          <div
            className="catalog-table-scroll"
            role="region"
            aria-label="Gruppi e catene montuose, scorri per tutte le colonne"
            tabIndex={0}
          >
            <table className="catalog-table classification-table">
              <caption className="sr-only">
                Atlante dei gruppi e delle catene, pagina {page} di {pages}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Gruppo / catena</th>
                  <th scope="col">Livello nell’archivio</th>
                  <th scope="col">Gerarchia di appartenenza</th>
                  <th scope="col">Esplora</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice((page - 1) * pageSize, page * pageSize).map((row) => (
                  <tr key={row.kind + row.id}>
                    <th scope="row">
                      {row.kind === 'range' ? (
                        <button
                          className="table-name"
                          onClick={() => update({ rangeId: row.id, q: '' })}
                        >
                          {row.name} <span aria-hidden="true">↳</span>
                        </button>
                      ) : (
                        <span className="classification-name">{row.name}</span>
                      )}
                      <small className="table-record">
                        {row.alpine ? 'ARCO ALPINO' : 'ALTRE CATENE'}
                      </small>
                    </th>
                    <td>
                      <RecordLabel
                        tone={
                          row.kind === 'group'
                            ? 'group'
                            : row.level === 'Sezione'
                              ? 'section'
                              : row.level === 'Sottosezione'
                                ? 'subsection'
                                : 'range'
                        }
                      >
                        {row.level}
                      </RecordLabel>
                    </td>
                    <td>
                      <div className="classification-path">
                        {row.path.length
                          ? row.path.map((name, i) => (
                              <button
                                key={row.ancestors[i]}
                                className="table-link"
                                onClick={() => update({ rangeId: row.ancestors[i], q: '' })}
                              >
                                {name}
                                {i < row.path.length - 1 ? ' ›' : ''}
                              </button>
                            ))
                          : 'Sistema montuoso'}
                      </div>
                    </td>
                    <td>
                      <div className="classification-actions">
                        <a
                          className="table-link"
                          href={
                            '/mountains?' +
                            (row.kind === 'group' ? 'groupId=' : 'rangeId=') +
                            row.id
                          }
                        >
                          Montagne ↗
                        </a>
                        <a
                          className="table-link"
                          href={
                            '/routes?' + (row.kind === 'group' ? 'groupId=' : 'rangeId=') + row.id
                          }
                        >
                          Itinerari ↗
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="classification-pagination" aria-label="Pagine dell’atlante">
            <button
              className="filter-button"
              disabled={page <= 1}
              onClick={() => update({ page: page - 1 })}
            >
              ← Precedente
            </button>
            <span>
              Pagina {page} di {pages}
            </span>
            <button
              className="filter-button"
              disabled={page >= pages}
              onClick={() => update({ page: page + 1 })}
            >
              Successiva →
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
