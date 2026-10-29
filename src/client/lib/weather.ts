/** The featured photograph and forecast always refer to this same location. */
export const featuredPlace = {
  name: 'Cervino',
  region: 'Alpi Pennine',
  latitude: 45.9764,
  longitude: 7.65833,
  elevation: 4478,
  timezone: 'Europe/Rome',
  dayImage: '/assets/cervino.jpg',
  nightImage: '/assets/cervino-night.jpg',
};
export interface Weather {
  temperature: number;
  minimum: number;
  maximum: number;
  humidity: number;
  wind: number;
  direction: number;
  code: number;
  updatedAt: number;
  sunrise: number;
  sunset: number;
  fetchedAt: number;
}
const ttl = 15 * 60 * 1000;
const storageKey = 'sym:weather:cervino:v1';
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw Error('Previsione non disponibile.');
  return value as Record<string, unknown>;
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw Error('Previsione incompleta.');
  return value;
}
export function parseWeather(payload: unknown, now: number): Weather {
  const data = record(payload),
    current = record(data.current),
    daily = record(data.daily);
  const first = (key: string) => number((daily[key] as unknown[] | undefined)?.[0]);
  return {
    temperature: number(current.temperature_2m),
    humidity: number(current.relative_humidity_2m),
    wind: number(current.wind_speed_10m),
    direction: number(current.wind_direction_10m),
    code: number(current.weather_code),
    updatedAt: number(current.time) * 1000,
    minimum: first('temperature_2m_min'),
    maximum: first('temperature_2m_max'),
    sunrise: first('sunrise') * 1000,
    sunset: first('sunset') * 1000,
    fetchedAt: now,
  };
}
export function isNightAt(now: number, weather: Weather | null): boolean {
  const date = (time: number) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: featuredPlace.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(time);
  if (weather && date(now) === date(weather.sunrise))
    return now < weather.sunrise || now >= weather.sunset;
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: featuredPlace.timezone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  );
  return hour < 7 || hour >= 19;
}
export function weatherLabel(code: number): string {
  if (code === 0) return 'Sereno';
  if (code <= 2) return 'Poco nuvoloso';
  if (code === 3) return 'Nuvoloso';
  if ([45, 48].includes(code)) return 'Nebbia';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Pioviggine';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Pioggia';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Neve';
  if ([95, 96, 99].includes(code)) return 'Temporali';
  return 'Condizioni variabili';
}
export function windDirection(degrees: number): string {
  return ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][
    Math.round((((degrees % 360) + 360) % 360) / 45) % 8
  ];
}
/** Shared request + short session cache: no D1 access, no automatic failure retries. */
export function createWeatherClient(fetcher: typeof fetch = fetch, now = () => Date.now()) {
  let cached: Weather | null = null,
    pending: Promise<Weather> | null = null;
  return async function loadWeather(): Promise<Weather> {
    if (cached && now() - cached.fetchedAt >= 0 && now() - cached.fetchedAt < ttl) return cached;
    if (pending) return pending;
    pending = (async () => {
      try {
        const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as Weather | null;
        if (
          stored &&
          [
            'temperature',
            'minimum',
            'maximum',
            'humidity',
            'wind',
            'direction',
            'code',
            'updatedAt',
            'sunrise',
            'sunset',
            'fetchedAt',
          ].every(
            (key) =>
              typeof stored[key as keyof Weather] === 'number' &&
              Number.isFinite(stored[key as keyof Weather]),
          ) &&
          now() - stored.fetchedAt >= 0 &&
          now() - stored.fetchedAt < ttl
        )
          return (cached = stored);
      } catch {
        /* Storage is optional. */
      }
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({
        latitude: String(featuredPlace.latitude),
        longitude: String(featuredPlace.longitude),
        elevation: String(featuredPlace.elevation),
        current:
          'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m',
        daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset',
        timezone: featuredPlace.timezone,
        forecast_days: '1',
        timeformat: 'unixtime',
        wind_speed_unit: 'kmh',
        temperature_unit: 'celsius',
      }).toString();
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(10000),
        credentials: 'omit',
      });
      if (!response.ok) throw Error('Meteo momentaneamente non disponibile.');
      cached = parseWeather(await response.json(), now());
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(cached));
      } catch {
        /* Storage is optional. */
      }
      return cached;
    })();
    try {
      return await pending;
    } finally {
      pending = null;
    }
  };
}
export const loadWeather = createWeatherClient();
