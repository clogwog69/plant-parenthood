import type { DayWeather, Location, Weather } from './types';

const CACHE = 'sprout.weather';
const HOUR = 3_600_000;

export async function getWeather(loc: Location): Promise<Weather> {
  const lat = loc.lat.toFixed(2);
  const lon = loc.lon.toFixed(2);
  const key = `${lat},${lon}`;
  let stale: Weather | null = null;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (c?.key === key) {
      stale = c.weather;
      if (Date.now() - c.weather.fetchedAt < HOUR) return c.weather;
    }
  } catch { /* ignore a broken cache */ }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max' +
      '&past_days=3&forecast_days=7&timezone=auto';
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather ' + res.status);
    const j = await res.json();
    const d = j.daily;
    const days: DayWeather[] = d.time.map((date: string, i: number) => ({
      date,
      tmax: d.temperature_2m_max[i] ?? 20,
      tmin: d.temperature_2m_min[i] ?? 10,
      rain: d.precipitation_sum[i] ?? 0,
      rainChance: d.precipitation_probability_max?.[i] ?? null,
      code: d.weather_code[i] ?? 0,
    }));
    const weather: Weather = {
      fetchedAt: Date.now(),
      temp: j.current.temperature_2m,
      code: j.current.weather_code,
      today: String(j.current.time).slice(0, 10),
      days,
    };
    try { localStorage.setItem(CACHE, JSON.stringify({ key, weather })); } catch { /* full */ }
    return weather;
  } catch (e) {
    if (stale) return stale; // offline: yesterday's forecast beats none
    throw e;
  }
}

export async function searchPlaces(query: string): Promise<Location[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
  if (!res.ok) throw new Error('geocode ' + res.status);
  const j = await res.json();
  return (j.results ?? []).map((r: { name: string; admin1?: string; country_code?: string; latitude: number; longitude: number }) => ({
    name: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export function currentPosition(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ name: 'My location', lat: p.coords.latitude, lon: p.coords.longitude }),
      reject,
      { timeout: 10_000, maximumAge: HOUR },
    );
  });
}

export type Sky = 'sun' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

export function describe(code: number): { sky: Sky; label: string } {
  if (code === 0) return { sky: 'sun', label: 'Clear' };
  if (code <= 2) return { sky: 'partly', label: 'Partly cloudy' };
  if (code === 3) return { sky: 'cloud', label: 'Cloudy' };
  if (code <= 48) return { sky: 'fog', label: 'Foggy' };
  if (code <= 57) return { sky: 'drizzle', label: 'Drizzle' };
  if (code <= 67) return { sky: 'rain', label: 'Rain' };
  if (code <= 77) return { sky: 'snow', label: 'Snow' };
  if (code <= 82) return { sky: 'rain', label: 'Showers' };
  if (code <= 86) return { sky: 'snow', label: 'Snow showers' };
  return { sky: 'storm', label: 'Storms' };
}
