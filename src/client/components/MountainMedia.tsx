import { useState } from 'react';
import type { CatalogDetail, PhotoProvider } from '../../shared/contracts';
import { api } from '../lib/api';
import { useResource } from '../hooks/use-resource';
import { landscape, formatNumber } from '../lib/presentation';
import './mountain-detail.css';

export function MountainMedia({ item }: { item: CatalogDetail }) {
  const [provider, setProvider] = useState<PhotoProvider>('commons');
  const [selected, setSelected] = useState(0);
  const result = useResource(
    (signal) => api.mountainGallery(item.id, provider, signal),
    [item.id, provider],
  );
  const gallery = result.data?.provider === provider ? result.data : null;
  const images = gallery?.images ?? [];
  const index = Math.min(selected, Math.max(0, images.length - 1));
  const photo = images[index];
  const fallback = landscape(item);
  const unavailable = result.error || gallery?.status === 'unavailable';
  return (
    <section className="mountain-media" aria-label={`Fotografie di ${item.name}`}>
      <div className="mountain-photo-stage">
        <MountainImage
          key={photo?.url ?? 'cover'}
          url={photo?.url ?? '/assets/' + fallback.file}
          alt={photo?.title ?? fallback.alt + (fallback.illustrative ? ' · foto illustrativa' : '')}
        />
        <div className="mountain-photo-shade" />
        <span className="mountain-photo-badge">
          {photo
            ? provider === 'commons'
              ? 'WIKIMEDIA COMMONS'
              : 'INSTAGRAM'
            : fallback.illustrative
              ? 'PAESAGGIO ILLUSTRATIVO'
              : 'FOTO DI COPERTINA'}
        </span>
        <div className="mountain-photo-heading">
          <p className="eyebrow light">
            {item.range || 'CIME E MONTAGNE'} · {item.countries.join(' / ')}
          </p>
          <h2 id="detail-title">{item.name}</h2>
          {item.elevationM != null && <span>↟ {formatNumber(item.elevationM)} m</span>}
        </div>
        {images.length > 1 && (
          <div className="mountain-photo-controls">
            <button
              aria-label="Foto precedente"
              onClick={() => setSelected((index + images.length - 1) % images.length)}
            >
              ←
            </button>
            <span>
              {index + 1} / {images.length}
            </span>
            <button
              aria-label="Foto successiva"
              onClick={() => setSelected((index + 1) % images.length)}
            >
              →
            </button>
          </div>
        )}
      </div>
      <div className="mountain-gallery-bar">
        <div className="mountain-photo-tabs" role="group" aria-label="Fonte delle fotografie">
          {(['commons', 'instagram'] as const).map((source) => (
            <button
              key={source}
              aria-pressed={provider === source}
              onClick={() => {
                setProvider(source);
                setSelected(0);
              }}
            >
              {source === 'commons' ? '◈ Foto libere' : '◎ Instagram'}
            </button>
          ))}
        </div>
        <span>{images.length ? `${images.length} fotografie` : 'Uno sguardo sulla montagna'}</span>
      </div>
      {images.length > 0 && (
        <div className="mountain-thumb-strip" aria-label="Scegli una fotografia">
          {images.map((image, i) => (
            <button
              key={image.id}
              onClick={() => setSelected(i)}
              aria-label={`Mostra foto ${i + 1}: ${image.title}`}
              aria-pressed={index === i}
            >
              <MountainImage url={image.url} alt="" />
            </button>
          ))}
        </div>
      )}
      <div className="mountain-photo-credit" aria-live="polite">
        {photo ? (
          <>
            <span>
              {photo.author} ·{' '}
              {photo.licenseUrl ? (
                <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
                  {photo.license}
                </a>
              ) : (
                photo.license
              )}
            </span>
            <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
              {provider === 'commons' ? 'Foto, autore e licenza' : 'Apri il post su Instagram'} ↗
            </a>
          </>
        ) : (
          <span>
            {result.loading
              ? 'Cerchiamo le fotografie della montagna…'
              : unavailable
                ? 'La galleria non è disponibile in questo momento.'
                : provider === 'instagram'
                  ? 'Le foto Instagram non sono ancora disponibili per questa montagna.'
                  : 'Nessuna fotografia collegata trovata su Wikimedia Commons.'}{' '}
            {unavailable && <button onClick={result.retry}>Riprova ↗</button>}
          </span>
        )}
      </div>
    </section>
  );
}
function MountainImage({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className="mountain-photo-missing" role="img" aria-label="Fotografia non più disponibile">
      ↟<span>Fotografia non disponibile</span>
    </div>
  ) : (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
