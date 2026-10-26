import { useState } from 'react';
import type { CatalogItem } from '../../shared/contracts';
import type { AdventuresState } from '../hooks/use-adventures';
import { useResource } from '../hooks/use-resource';
import { api } from '../lib/api';
import { landscape, formatNumber, mapURL } from '../lib/presentation';
import { Modal } from './Modal';
export function DetailModal({
  target,
  adventures,
  onClose,
  onOpen,
}: {
  target: Pick<CatalogItem, 'kind' | 'id'>;
  adventures: AdventuresState;
  onClose: () => void;
  onOpen: (item: CatalogItem) => void;
}) {
  const [copyMessage, setCopyMessage] = useState('');
  const result = useResource(
    (signal) => api.detail(target.kind, target.id, signal),
    [target.kind, target.id],
  );
  const item = result.data;
  const image = item ? landscape(item) : null;
  return (
    <Modal titleId="detail-title" onClose={onClose}>
      {item && image ? (
        <>
          <img
            className="detail-image"
            src={'/assets/' + image.file}
            alt={image.alt + (image.illustrative ? ' · foto illustrativa' : '')}
          />
          <div className="detail-body">
            <p className="eyebrow">{item.activity || 'CIME E MONTAGNE'} · ARCHIVIO 2017</p>
            <h2 id="detail-title">{item.name}</h2>
            <dl className="detail-facts">
              <div>
                <dt>Quota</dt>
                <dd>{item.elevationM ? formatNumber(item.elevationM) + ' m' : 'Non indicata'}</dd>
              </div>
              <div>
                <dt>Gruppo montuoso</dt>
                <dd>{item.range || 'Non indicato'}</dd>
              </div>
              <div>
                <dt>{item.kind === 'route' ? 'Gradi originali' : 'Paesi'}</dt>
                <dd>
                  {item.kind === 'route'
                    ? item.difficultyRaw || 'Non indicati'
                    : item.countries.join(' · ') || 'Non indicati'}
                </dd>
              </div>
              {item.kind === 'route' && (
                <>
                  <div>
                    <dt>Sviluppo</dt>
                    <dd>{item.lengthM ? formatNumber(item.lengthM) + ' m' : 'Non disponibile'}</dd>
                  </div>
                  <div>
                    <dt>Dislivello parete / via</dt>
                    <dd>{item.heightM ? formatNumber(item.heightM) + ' m' : 'Non disponibile'}</dd>
                  </div>
                  <div>
                    <dt>Regione</dt>
                    <dd>{item.region || 'Non indicata'}</dd>
                  </div>
                </>
              )}
            </dl>
            {image.illustrative && <p>La foto di copertina illustra il paesaggio alpino.</p>}
            {item.description && <p>{item.description}</p>}
            {item.lengthDescription && <p>{item.lengthDescription}</p>}
            <p>
              Informazioni storiche del 28 dicembre 2017. Verifica relazione, accessibilità e
              condizioni aggiornate prima di partire.
            </p>
            <div className="detail-actions">
              <button
                className="button"
                disabled={adventures.pending || adventures.loading || !adventures.canSave}
                onClick={() => void adventures.toggle(item)}
              >
                {adventures.saved(item) ? '♥ Salvata · Rimuovi' : '♡ Salva avventura'}
              </button>
              {item.latitude !== null && item.longitude !== null && (
                <a
                  className="secondary-button"
                  href={mapURL(item.latitude, item.longitude)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.kind === 'mountain' ? 'Mappa della cima' : 'Posizione registrata'} ↗
                </a>
              )}
              <button
                className="secondary-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(location.href);
                    setCopyMessage('Link copiato.');
                  } catch {
                    setCopyMessage('Copia il link dalla barra degli indirizzi.');
                  }
                }}
              >
                Copia link ↗
              </button>
            </div>
            <p role="status">{copyMessage}</p>
            {adventures.needsSignIn && adventures.signInUrl && (
              <a className="source-link" href={adventures.signInUrl}>
                Accedi per salvare questa meta ↗
              </a>
            )}
            {adventures.error && <p role="alert">{adventures.error}</p>}
            {item.kind === 'route' && item.latitude === null && (
              <p className="notice">
                Coordinate del percorso non disponibili. La posizione della cima e il parcheggio,
                quando presenti, sono riferimenti distinti dal punto di partenza.
              </p>
            )}
            {item.mountainLocation && (
              <a
                className="source-link"
                href={mapURL(item.mountainLocation.latitude, item.mountainLocation.longitude)}
                target="_blank"
                rel="noreferrer"
              >
                Mappa della cima associata ↗
              </a>
            )}
            {item.parking && (
              <>
                <h3>Parcheggio associato</h3>
                <p>{item.parking.name}</p>
                {item.parking.latitude !== null && item.parking.longitude !== null && (
                  <a
                    className="source-link"
                    href={mapURL(item.parking.latitude, item.parking.longitude)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Posizione del parcheggio ↗
                  </a>
                )}
              </>
            )}
            {item.track?.url && (
              <>
                <h3>Traccia storica</h3>
                <a className="source-link" href={item.track.url} target="_blank" rel="noreferrer">
                  {item.track.name || 'Apri la fonte della traccia'} ↗
                </a>
              </>
            )}
            {item.relatedRoutes.length > 0 && (
              <>
                <h3>Itinerari su questa montagna</h3>
                {item.relatedRoutes.map((route) => (
                  <button key={route.key} className="related-route" onClick={() => onOpen(route)}>
                    {route.name} ↗
                  </button>
                ))}
              </>
            )}
            {item.images.length > 0 && (
              <>
                <h3>Foto dall’archivio</h3>
                <div className="archive-gallery">
                  {item.images.map((image) => (
                    <ArchiveImage key={image.url} {...image} />
                  ))}
                </div>
              </>
            )}
            <h3>Fonti originali</h3>
            {item.sources.length ? (
              item.sources.map((source, index) => (
                <div key={index}>
                  {source.url ? (
                    <a className="source-link" href={source.url} target="_blank" rel="noreferrer">
                      {source.name} · Apri la fonte ↗
                    </a>
                  ) : (
                    <p>{source.name}: collegamento incompleto nell’archivio.</p>
                  )}
                </div>
              ))
            ) : (
              <p>Nessuna relazione esterna registrata per questa scheda.</p>
            )}
            <p>
              I collegamenti esterni appartengono all’archivio storico e potrebbero non essere più
              disponibili.
            </p>
            <p className="archive-note">
              Share Your Mountain · ID storico {item.id} · foto e informazioni dalle fonti
              originali.
            </p>
          </div>
        </>
      ) : (
        <div className="dialog-padding">
          <h2 id="detail-title">
            {result.loading ? 'Apriamo la scheda…' : 'Scheda non disponibile'}
          </h2>
          {result.error && (
            <>
              <p role="alert">{result.error}</p>
              <button className="button" onClick={result.retry}>
                Riprova
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
function ArchiveImage({ url, description }: { url: string; description: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure>
      {failed ? (
        <p>Foto storica non disponibile.</p>
      ) : (
        <img
          src={url}
          alt={description || 'Foto dall’archivio storico'}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
      <figcaption>
        <a href={url} target="_blank" rel="noreferrer">
          {description || 'Apri la foto originale'} ↗
        </a>
      </figcaption>
    </figure>
  );
}
