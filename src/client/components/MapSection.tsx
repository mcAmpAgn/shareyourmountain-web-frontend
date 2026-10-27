import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogItem, MapBounds } from '../../shared/contracts';
import type { MapView } from './MountainMap';
import { api } from '../lib/api';
import { formatNumber } from '../lib/presentation';
import { useResource } from '../hooks/use-resource';
import './map.css';

const MountainMap = lazy(() => import('./MountainMap'));
const destinations: { label: string; view: MapView }[] = [
  { label: 'Arco alpino', view: { latitude: 46.3, longitude: 10.5, zoom: 6 } },
  { label: 'Dolomiti', view: { latitude: 46.45, longitude: 11.85, zoom: 9 } },
  { label: 'Monte Bianco', view: { latitude: 45.83, longitude: 6.86, zoom: 10 } },
];

function Explorer({ onOpen }: { onOpen: (item: CatalogItem) => void }) {
  const [bounds, setBounds] = useState<MapBounds>([5, 43, 16, 49]);
  const [view, setView] = useState(destinations[0].view);
  const [minElevation, setMinElevation] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onBounds = useCallback((next: MapBounds) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setBounds(next), 250);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const result = useResource(
    (signal) => api.mapMountains(bounds, minElevation, signal),
    [bounds.join(','), minElevation],
  );
  const items = result.data?.items ?? [];
  return (
    <>
      <div className="map-toolbar">
        <div className="map-destinations" aria-label="Sposta la mappa">
          {destinations.map((destination) => (
            <button key={destination.label} onClick={() => setView({ ...destination.view })}>
              {destination.label} ↗
            </button>
          ))}
        </div>
        <label>
          Quota minima{' '}
          <select
            value={minElevation}
            onChange={(event) => setMinElevation(Number(event.target.value))}
          >
            <option value={0}>Tutte le quote</option>
            <option value={2000}>2.000 m</option>
            <option value={3000}>3.000 m</option>
            <option value={4000}>4.000 m</option>
          </select>
        </label>
      </div>
      <div className="map-layout">
        <Suspense fallback={<div className="map-placeholder">Caricamento mappa…</div>}>
          <MountainMap items={items} view={view} onBounds={onBounds} onOpen={onOpen} />
        </Suspense>
        <aside
          className="map-results"
          aria-label="Cime nell’area visibile"
          aria-busy={result.loading}
        >
          <p className="eyebrow">NEL TUO ORIZZONTE</p>
          <h3>Cime da scoprire</h3>
          <p role="status">
            {result.loading
              ? 'Cerchiamo le cime in quest’area…'
              : result.error
                ? 'Ricerca non disponibile.'
                : `${formatNumber(items.length)} cime nell’area visibile`}
          </p>
          {result.error && (
            <div role="alert">
              <p>{result.error}</p>
              <button className="text-button" onClick={result.retry}>
                Riprova
              </button>
            </div>
          )}
          {!result.loading && !result.error && items.length === 0 && (
            <p>Sposta la mappa o scegli una quota più bassa per trovare altre montagne.</p>
          )}
          {items.length > 0 && (
            <ul>
              {items.slice(0, 6).map((item) => (
                <li key={item.key}>
                  <button onClick={() => onOpen(item)}>
                    <span>
                      {item.name}
                      <small>{item.range || item.region}</small>
                    </span>
                    <b>{item.elevationM === null ? '—' : formatNumber(item.elevationM)} m ↗</b>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {result.data && items.length >= result.data.limit && (
            <p>
              Mostriamo fino a {formatNumber(result.data.limit)} cime, dalle più alte. Aumenta lo
              zoom per esplorare l’area nel dettaglio.
            </p>
          )}
          <p className="map-note">
            I punti indicano le cime dell’archivio storico, non l’inizio di un sentiero.
          </p>
        </aside>
      </div>
    </>
  );
}

export function MapSection({ onOpen }: { onOpen: (item: CatalogItem) => void }) {
  const [active, setActive] = useState(false);
  return (
    <section id="map" className="map-section wrapper section-space" aria-labelledby="map-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SEGUI LA TUA CURIOSITÀ</p>
          <h2 id="map-title">Il prossimo orizzonte, sulla mappa.</h2>
          <p className="section-description">
            Sposta lo sguardo, trova una cima e scopri la sua storia.
          </p>
        </div>
        <span className="map-label">⌖ OpenStreetMap</span>
      </div>
      {active ? (
        <Explorer onOpen={onOpen} />
      ) : (
        <div className="map-welcome">
          <span aria-hidden="true" className="map-compass">
            ⌖
          </span>
          <h3>Le montagne, da un altro punto di vista.</h3>
          <p>
            Esplora le cime sulla mappa interattiva. Lo sfondo viene caricato da OpenStreetMap
            quando apri la mappa.
          </p>
          <button className="map-open" onClick={() => setActive(true)}>
            Apri la mappa <span aria-hidden="true">↗</span>
          </button>
        </div>
      )}
      <div className="map-footnote">
        <span>Trascina per spostarti · Usa + e − per lo zoom</span>
        <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">
          Segnala un problema sulla mappa ↗
        </a>
      </div>
    </section>
  );
}
