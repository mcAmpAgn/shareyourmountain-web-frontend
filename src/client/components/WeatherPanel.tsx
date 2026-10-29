import type { Weather } from '../lib/weather';
import { featuredPlace, weatherLabel, windDirection } from '../lib/weather';
export function WeatherPanel({
  data,
  loading,
  error,
  night,
  onRetry,
}: {
  data: Weather | null;
  loading: boolean;
  error: string | null;
  night: boolean;
  onRetry: () => void;
}) {
  const degrees = (value: number) => Math.round(value) + '°';
  return (
    <aside className="weather-panel" aria-label="Meteo del luogo in copertina">
      <div className="weather-place">
        <span className="weather-dot" /> IN QUESTO MOMENTO, AL CERVINO
      </div>
      <div className="weather-location">
        {featuredPlace.region} <span>· {featuredPlace.elevation.toLocaleString('it-IT')} m</span>
      </div>
      {data ? (
        <>
          <div className="weather-main">
            <span aria-hidden="true" className="weather-symbol">
              {data.code === 0
                ? night
                  ? '☾'
                  : '☀'
                : data.code >= 71 && data.code <= 86
                  ? '❄'
                  : '☁'}
            </span>
            <strong>
              {degrees(data.temperature)}
              <small>C</small>
            </strong>
          </div>
          <p className="weather-condition">
            {weatherLabel(data.code)}{' '}
            <span>
              Min {degrees(data.minimum)} · Max {degrees(data.maximum)}
            </span>
          </p>
          <dl className="weather-facts">
            <div>
              <dt>VENTO</dt>
              <dd>
                {Math.round(data.wind)} <small>km/h {windDirection(data.direction)}</small>
              </dd>
            </div>
            <div>
              <dt>UMIDITÀ</dt>
              <dd>
                {Math.round(data.humidity)}
                <small>%</small>
              </dd>
            </div>
          </dl>
          <p className="weather-source">
            Previsione delle{' '}
            <time dateTime={new Date(data.updatedAt).toISOString()}>
              {new Intl.DateTimeFormat('it-IT', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: featuredPlace.timezone,
              }).format(data.updatedAt)}
            </time>{' '}
            ·{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo ↗
            </a>
          </p>
          {error && (
            <p className="weather-unavailable">
              Aggiornamento non disponibile. <button onClick={onRetry}>Riprova</button>
            </p>
          )}
        </>
      ) : (
        <div className="weather-placeholder" role="status">
          <span aria-hidden="true">{night ? '☾' : '☀'}</span>
          <p>{loading ? 'Uno sguardo al cielo…' : 'Meteo non disponibile'}</p>
          {!loading && <button onClick={onRetry}>Riprova ↗</button>}
        </div>
      )}
    </aside>
  );
}
