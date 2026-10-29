import { useEffect, useState } from 'react';
import { useResource } from './use-resource';
import { isNightAt, loadWeather } from '../lib/weather';
export function useFeaturedWeather() {
  const [now, setNow] = useState(Date.now);
  const [revision, setRevision] = useState(0);
  const weather = useResource(() => loadWeather(), [revision], true);
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 60000);
    const refresh = window.setInterval(() => {
      if (!document.hidden) setRevision((v) => v + 1);
    }, 15 * 60000);
    const visible = () => {
      if (!document.hidden) {
        setNow(Date.now());
        setRevision((v) => v + 1);
      }
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(clock);
      clearInterval(refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  return { ...weather, night: isNightAt(now, weather.data) };
}
