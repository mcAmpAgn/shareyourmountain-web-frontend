import { useState } from 'react';
import type { Filters, CatalogItem } from '../../shared/contracts';
import { SearchAutocomplete } from './SearchAutocomplete';
export function Hero({
  filters,
  onSearch,
  onOpen,
}: {
  filters: Filters | null;
  onSearch: (query: string, activity: string) => void;
  onOpen: (item: CatalogItem) => void;
}) {
  const [query, setQuery] = useState(''),
    [activity, setActivity] = useState('');
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-shade" />
      <div className="hero-content wrapper">
        <p className="eyebrow light">
          <span />
          LA MONTAGNA È PIÙ BELLA, CONDIVISA.
        </p>
        <h1 id="hero-title">
          Fuori c’è un mondo.
          <br />
          Trova la tua <em>montagna.</em>
        </h1>
        <p className="hero-description">
          Cime da raggiungere. Sentieri da scoprire.
          <br />
          La tua prossima avventura comincia qui.
        </p>
        <form
          className="search-bar"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch(query.trim(), activity);
          }}
        >
          <SearchAutocomplete
            value={query}
            activity={activity}
            onChange={setQuery}
            onSelect={onOpen}
            onSearch={() => onSearch(query.trim(), activity)}
          />
          <label className="search-activity">
            <span className="field-label">SEGUI LA TUA PASSIONE</span>
            <select
              aria-label="Attività"
              value={activity}
              onChange={(event) => setActivity(event.target.value)}
            >
              <option value="">Tutte le attività</option>
              <option value="mountain">Cime e montagne</option>
              {filters?.activities.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button search-submit">
            Esplora <span aria-hidden="true">↗</span>
          </button>
        </form>
        <div className="hero-tags">
          <span>Lasciati ispirare</span>
          {['Dolomiti', 'Alpi Pennine', 'Grigna'].map((place) => (
            <button
              key={place}
              onClick={() => {
                setQuery(place);
                onSearch(place, '');
              }}
            >
              {place} ↗
            </button>
          ))}
        </div>
      </div>
      <div className="hero-bottom wrapper">
        <span>↟ &nbsp; PASSO DOPO PASSO, STORIA DOPO STORIA.</span>
        <span>
          46°37′ N &nbsp; 12°18′ E <i /> Dolomiti, Italia
        </span>
      </div>
    </section>
  );
}
