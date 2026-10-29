import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWeatherClient,
  parseWeather,
  isNightAt,
  weatherLabel,
  windDirection,
} from '../src/client/lib/weather.js';
const at = (value: string) => Date.parse(value);
const sample = {
  current: {
    temperature_2m: -5.4,
    relative_humidity_2m: 72,
    wind_speed_10m: 18,
    wind_direction_10m: 315,
    weather_code: 71,
    time: at('2026-10-29T10:00:00Z') / 1000,
  },
  daily: {
    temperature_2m_min: [-10],
    temperature_2m_max: [-3],
    sunrise: [at('2026-10-29T06:05:00Z') / 1000],
    sunset: [at('2026-10-29T16:20:00Z') / 1000],
  },
};
test('featured weather uses solar boundaries and the featured timezone rather than the visitor timezone', () => {
  const weather = parseWeather(sample, at('2026-10-29T10:00:00Z'));
  assert.equal(isNightAt(at('2026-10-29T06:04:59Z'), weather), true);
  assert.equal(isNightAt(at('2026-10-29T06:05:00Z'), weather), false);
  assert.equal(isNightAt(at('2026-10-29T16:20:00Z'), weather), true);
  assert.equal(isNightAt(at('2026-10-30T12:00:00Z'), weather), false);
  assert.equal(isNightAt(at('2026-07-01T17:30:00Z'), null), true);
  assert.equal(weatherLabel(weather.code), 'Neve');
  assert.equal(windDirection(weather.direction), 'NO');
  assert.equal(windDirection(360), 'N');
  assert.throws(() => parseWeather({ current: {}, daily: {} }, 0), /incompleta/);
  assert.throws(
    () => parseWeather({ ...sample, current: { ...sample.current, temperature_2m: null } }, 0),
    /incompleta/,
  );
});
test('weather calls are coalesced, expire and recover from failed requests without using D1', async () => {
  let calls = 0,
    now = at('2026-10-29T10:00:00Z');
  const client = createWeatherClient(
    (async (url: URL, options: RequestInit) => {
      calls++;
      assert.equal(url.hostname, 'api.open-meteo.com');
      assert.equal(url.searchParams.get('elevation'), '4478');
      assert.equal(options.credentials, 'omit');
      return Response.json(sample);
    }) as typeof fetch,
    () => now,
  );
  await Promise.all([client(), client()]);
  await client();
  assert.equal(calls, 1);
  now += 15 * 60000;
  await client();
  assert.equal(calls, 2);
  let failed = true;
  const retry = createWeatherClient(
    (async () =>
      failed ? new Response(null, { status: 503 }) : Response.json(sample)) as typeof fetch,
    () => now,
  );
  await assert.rejects(retry(), /non disponibile/);
  failed = false;
  assert.equal((await retry()).temperature, -5.4);
});
