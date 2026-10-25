import type { CatalogItem } from '../../shared/contracts';
import { landscape, formatNumber } from '../lib/presentation';
export function CatalogCard({
  item,
  saved,
  pending,
  onSave,
  onOpen,
}: {
  item: CatalogItem;
  saved: boolean;
  pending: boolean;
  onSave: () => void;
  onOpen: () => void;
}) {
  const image = landscape(item);
  return (
    <article className={'card ' + (item.kind === 'route' ? 'route' : '')}>
      <button
        className="save-card"
        onClick={onSave}
        disabled={pending}
        aria-label={`${saved ? 'Rimuovi' : 'Salva'} ${item.name}`}
        aria-pressed={saved}
      >
        {saved ? '♥' : '♡'}
      </button>
      <button className="card-open" onClick={onOpen} aria-label={'Scopri ' + item.name}>
        <div className="card-image">
          <img
            src={'/assets/' + image.file}
            alt={image.alt + (image.illustrative ? ' · foto illustrativa' : '')}
            loading="lazy"
          />
          <span className="card-badge">{item.activity || 'CIME E MONTAGNE'}</span>
          {image.illustrative && <span className="card-alt">Foto illustrativa</span>}
        </div>
        <div className="card-body">
          <p className="card-place">{item.region || item.range || 'Archivio alpino'}</p>
          <h3>{item.name}</h3>
          <div className="card-meta">
            <span>
              △ {item.elevationM ? formatNumber(item.elevationM) + ' m' : 'Quota non indicata'}
            </span>
            <span>
              {item.kind === 'route'
                ? item.difficultyRaw || 'Grado non indicato'
                : item.routeCount
                  ? item.routeCount + ' itinerari'
                  : item.countries.join(' · ')}
            </span>
          </div>
          <div className="card-foot">
            <span>{item.kind === 'route' ? 'Scopri l’itinerario' : 'Scopri la montagna'}</span>
            <span aria-hidden="true">↗</span>
          </div>
        </div>
      </button>
    </article>
  );
}
