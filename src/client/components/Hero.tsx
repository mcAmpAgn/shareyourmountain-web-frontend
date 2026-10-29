import { useState } from 'react';
import type { Filters, CatalogItem } from '../../shared/contracts';
import { SearchAutocomplete } from './SearchAutocomplete';
import { useFeaturedWeather } from '../hooks/use-featured-weather';
import { featuredPlace } from '../lib/weather';
import { WeatherPanel } from './WeatherPanel';
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
  const weather = useFeaturedWeather();
  const [appearance, setAppearance] = useState<'auto' | 'day' | 'night'>('auto');
  const night = appearance === 'auto' ? weather.night : appearance === 'night';
  return (
    <section
      className={`hero alpine-hero ${night ? 'hero-night' : 'hero-day'}`}
      aria-labelledby="hero-title"
      style={{
        backgroundImage: `url('${night ? featuredPlace.nightImage : featuredPlace.dayImage}')`,
      }}
    >
      <div className="hero-shade" />
      <div className="hero-content wrapper">
        <div className="hero-lead">
          <div className="hero-copy">
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
          </div>
          <WeatherPanel {...weather} night={night} onRetry={weather.retry} />
        </div>
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
        <label className="hero-appearance">
          Sfondo{' '}
          <select
            aria-label="Aspetto dello sfondo"
            value={appearance}
            onChange={(event) => setAppearance(event.target.value as typeof appearance)}
          >
            <option value="auto">Automatico · {weather.night ? 'notte' : 'giorno'}</option>
            <option value="day">Giorno</option>
            <option value="night">Notte</option>
          </select>
        </label>
        <a
          href="https://www.openstreetmap.org/?mlat=45.9764&mlon=7.65833#map=12/45.9764/7.65833"
          target="_blank"
          rel="noreferrer"
        >
          45°58′ N &nbsp; 7°39′ E <i /> Cervino ↗
        </a>
      </div>
    </section>
  );
}
