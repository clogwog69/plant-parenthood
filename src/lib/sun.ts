// How much sun a plant wants through the day, hour by hour from sunrise to sunset.
import { guideFor } from './guide';
import type { Guide, Location, Plant, Weather } from './types';

export type Light = 'full' | 'shade' | 'bright' | 'low';

export const LIGHTS: { value: Light; label: string; short: string }[] = [
  { value: 'full', label: 'Full sun', short: 'Full sun' },
  { value: 'shade', label: 'Shade outside', short: 'Shade' },
  { value: 'bright', label: 'Bright light, no sunbeams', short: 'Bright' },
  { value: 'low', label: 'Low light', short: 'Low light' },
];
export const LIGHT_LABEL = Object.fromEntries(LIGHTS.map((l) => [l.value, l.label])) as Record<Light, string>;

/** The three hottest hours, 11am to 2pm. */
export const MIDDAY = [11, 12, 13];
/** Hot enough that tender leaves scorch in the midday sun. */
export const HOT = 30;

// Guides that say full sun, but in an Australian summer the leaves burn and it bolts without a break at midday.
const MIDDAY_SHADE = new Set(['dill']);

type Shape = 'full' | 'midday' | 'morning' | 'some' | 'shade' | 'bright' | 'low';

function shapeOf(g: Guide): Shape {
  const l = g.light.toLowerCase();
  if (MIDDAY_SHADE.has(g.key)) return 'midday';
  if (/no direct/.test(l)) return g.category === 'houseplant' ? 'bright' : 'shade';
  if (/as much bright/.test(l)) return 'full';
  if (/^low|anything from low/.test(l) && !/bright/.test(l)) return 'low';
  if (/indirect|^bright shade/.test(l)) return 'bright';
  if (/direct sun/.test(l)) return 'some';
  if (/part shade to sun|cool weather|sun to part shade/.test(l)) return 'midday';
  if (/^morning sun|^part shade/.test(l)) return 'morning';
  return 'full';
}

/** What the plant wants in the hour starting at `h` (0 to 23). */
export function wantAt(g: Guide, h: number): Light {
  switch (shapeOf(g)) {
    case 'full': return 'full';
    case 'midday': return MIDDAY.includes(h) ? 'shade' : 'full';
    case 'morning': return h < 11 ? 'full' : 'shade';
    case 'some': return h < 11 ? 'full' : 'bright';
    case 'shade': return 'shade';
    case 'bright': return 'bright';
    case 'low': return 'low';
  }
}

export function wants(p: Pick<Plant, 'guideKey' | 'species'>, hours: number[]): Record<number, Light> {
  const g = guideFor(p.guideKey, p.species);
  return Object.fromEntries(hours.map((h) => [h, wantAt(g, h)]));
}

/** True when the plant wants sun, but not in the middle of the day. */
export function needsMiddayShade(p: Pick<Plant, 'guideKey' | 'species'>): boolean {
  const g = guideFor(p.guideKey, p.species);
  return wantAt(g, 9) === 'full' && MIDDAY.some((h) => wantAt(g, h) === 'shade');
}

const RAD = Math.PI / 180;

/** Sunrise and sunset for this place and date, as times. Null in polar day or night. */
export function sunTimes(lat: number, lon: number, date = new Date()): { rise: Date; set: Date } | null {
  const jd = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12) / 86_400_000 + 2440587.5;
  const n = Math.round(jd - 2451545 + 0.0008);
  const j = n - lon / 360;
  const m = (357.5291 + 0.98560028 * j) % 360;
  const c = 1.9148 * Math.sin(m * RAD) + 0.02 * Math.sin(2 * m * RAD) + 0.0003 * Math.sin(3 * m * RAD);
  const lam = (m + c + 180 + 102.9372) % 360;
  const transit = 2451545 + j + 0.0053 * Math.sin(m * RAD) - 0.0069 * Math.sin(2 * lam * RAD);
  const dec = Math.asin(Math.sin(lam * RAD) * Math.sin(23.4397 * RAD));
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(dec)) / (Math.cos(lat * RAD) * Math.cos(dec));
  if (cosW < -1 || cosW > 1) return null;
  const w = Math.acos(cosW) / RAD / 360;
  const toDate = (jday: number) => new Date((jday - 2440587.5) * 86_400_000);
  return { rise: toDate(transit - w), set: toDate(transit + w) };
}

export interface Day { rise: Date | null; set: Date | null; hours: number[] }

/** The clock hours that have daylight in them today. Without a location, 6am to 7pm. */
export function daylight(loc: Location | null, now = new Date()): Day {
  const t = loc ? sunTimes(loc.lat, loc.lon, now) : null;
  const from = t ? (t.rise.getMinutes() > 45 ? t.rise.getHours() + 1 : t.rise.getHours()) : 6;
  // An hour counts if the sun is up for at least a quarter of it.
  const to = t ? (t.set.getMinutes() >= 15 ? t.set.getHours() : t.set.getHours() - 1) : 18;
  const hours: number[] = [];
  for (let h = from; h <= to; h += 1) hours.push(h);
  return { rise: t?.rise ?? null, set: t?.set ?? null, hours };
}

/** "6am", "12pm", "2pm". */
export function hourLabel(h: number): string {
  const x = ((h % 24) + 24) % 24;
  return `${x % 12 || 12}${x < 12 ? 'am' : 'pm'}`;
}
export const clock = (d: Date) => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '').toLowerCase();

export interface Run { from: number; to: number; light: Light }

/** Neighbouring hours with the same light, merged. `to` is the hour the run ends at. */
export function runs(hours: number[], at: (h: number) => Light | undefined): Run[] {
  const out: Run[] = [];
  for (const h of hours) {
    const light = at(h);
    if (!light) continue;
    const last = out[out.length - 1];
    if (last && last.light === light && last.to === h) last.to = h + 1;
    else out.push({ from: h, to: h + 1, light });
  }
  return out;
}

/** Where what it gets differs from what it wants, e.g. "11am–2pm: gets full sun, wants shade". */
export function mismatches(p: Plant, hours: number[]): { from: number; to: number; gets: Light; want: Light }[] {
  const g = guideFor(p.guideKey, p.species);
  const out: { from: number; to: number; gets: Light; want: Light }[] = [];
  for (const h of hours) {
    const gets = p.sun?.[h];
    const want = wantAt(g, h);
    if (!gets || gets === want) continue;
    const last = out[out.length - 1];
    if (last && last.to === h && last.gets === gets && last.want === want) last.to = h + 1;
    else out.push({ from: h, to: h + 1, gets, want });
  }
  return out;
}

/** The first hot day in today and tomorrow, if any. */
export function hotDay(weather: Weather | null): { tmax: number; today: boolean } | null {
  if (!weather) return null;
  const i = weather.days.findIndex((d) => d.date === weather.today);
  if (i < 0) return null;
  for (const [k, d] of weather.days.slice(i, i + 2).entries()) if (d.tmax >= HOT) return { tmax: d.tmax, today: k === 0 };
  return null;
}

/** Garden plants that should be in shade at midday and are not already, for a hot-day reminder. */
export function middaySunburn(plants: Plant[]): Plant[] {
  return plants.filter((p) => p.place === 'garden' && needsMiddayShade(p) && !MIDDAY.every((h) => p.sun?.[h] === 'shade' || p.sun?.[h] === 'bright' || p.sun?.[h] === 'low'));
}
