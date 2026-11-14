import { guideFor } from './guide';
import type { Location, Plant, Season, Task, Weather } from './types';

export const DAY = 86_400_000;

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole calendar days from b to a (positive when a is later). */
export function dayDiff(a: number, b: number): number {
  return Math.round((startOfDay(a) - startOfDay(b)) / DAY);
}

export const plantName = (p: Plant) => p.nickname?.trim() || p.species;

const SOUTH_ZONES = /^(Australia\/|Pacific\/(Auckland|Fiji|Chatham)|Africa\/(Johannesburg|Maputo|Harare|Windhoek)|America\/(Sao_Paulo|Argentina|Santiago|Montevideo|Lima|La_Paz|Asuncion)|Antarctica\/)/;

export function isSouthern(loc: Location | null): boolean {
  if (loc) return loc.lat < 0;
  try {
    return SOUTH_ZONES.test(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return false;
  }
}

const NORTH: Season[] = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
const FLIP: Record<Season, Season> = { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' };

export function seasonFor(loc: Location | null, now = Date.now()): Season {
  const s = NORTH[new Date(now).getMonth()];
  return isSouthern(loc) ? FLIP[s] : s;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const weekday = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString(undefined, { weekday: 'long' });

function todayIndex(w: Weather | null): number {
  return w ? w.days.findIndex((d) => d.date === w.today) : -1;
}

export interface WaterPlan {
  dueIn: number;
  every: number;
  reason: string;
  skipped?: boolean;
}

export function waterPlan(plant: Plant, weather: Weather | null, loc: Location | null, now = Date.now()): WaterPlan {
  const g = guideFor(plant.guideKey, plant.species);
  const season = seasonFor(loc, now);
  const outdoor = plant.place === 'garden';
  const idx = todayIndex(weather);
  let factor = 1;
  let why = '';

  if (outdoor && weather && idx >= 0) {
    const next = weather.days.slice(idx, idx + 3);
    const hot = Math.round(next.reduce((s, d) => s + d.tmax, 0) / next.length);
    if (hot >= 35) { factor = 0.45; why = `Scorching days ahead (around ${hot}°), so it dries out very fast`; }
    else if (hot >= 30) { factor = 0.6; why = `Hot days ahead (around ${hot}°), so it needs water more often`; }
    else if (hot >= 25) { factor = 0.8; why = `Warm weather (around ${hot}°) means a bit more water`; }
    else if (hot >= 18) { factor = 1; }
    else if (hot >= 12) { factor = 1.4; why = `Cool weather (around ${hot}°), so the soil stays damp longer`; }
    else { factor = 1.8; why = `Cold weather (around ${hot}°), so it barely drinks`; }
  } else if (outdoor) {
    if (season === 'summer') { factor = 0.7; why = 'Summer, so it needs water more often'; }
    if (season === 'winter') { factor = 1.5; why = 'Winter, so the soil stays damp longer'; }
  } else {
    if (season === 'summer') { factor = 0.85; why = 'Warmer months, so a little more often'; }
    if (season === 'winter') { factor = 1.5; why = 'Winter slows growth, so it needs less water'; }
  }
  if (outdoor && plant.potted) factor *= 0.75;

  const every = clamp(Math.round(g.waterDays * factor), 1, 45);
  const base = `About every ${every === 1 ? 'day' : `${every} days`} right now`;
  let reason = why ? `${why}. ${base}.` : `${base}.`;

  let last = plant.lastWatered;
  if (outdoor && weather && idx > 0) {
    for (let i = idx - 1; i >= 0; i--) {
      const d = weather.days[i];
      if (d.rain >= 5) {
        const t = new Date(d.date + 'T12:00').getTime();
        if (!last || t > last) {
          last = t;
          reason = `${Math.round(d.rain)} mm of rain on ${weekday(d.date)} did the last watering. ${base}.`;
        }
        break;
      }
    }
  }

  if (!last) {
    return { dueIn: 0, every, reason: 'No watering logged yet. Feel the soil and give it a drink if it is dry.' };
  }

  let dueIn = dayDiff(last + every * DAY, now);

  if (plant.holdWaterUntil && plant.holdWaterUntil > now) {
    const hold = Math.max(1, dayDiff(plant.holdWaterUntil, now));
    if (hold > dueIn) {
      dueIn = hold;
      reason = 'The soil was soggy at the last check-in, so it is getting time to dry out.';
    }
  }

  if (outdoor && weather && idx >= 0 && dueIn <= 1) {
    for (let i = idx; i <= idx + 1 && i < weather.days.length; i++) {
      const d = weather.days[i];
      if (d.rain >= 5 && (d.rainChance ?? 100) >= 60) {
        return {
          dueIn: Math.min(dueIn, 0),
          every,
          skipped: true,
          reason: `Rain is on the way ${i === idx ? 'today' : 'tomorrow'} (about ${Math.round(d.rain)} mm). Leave the watering can where it is.`,
        };
      }
    }
  }

  return { dueIn, every, reason };
}

export function repotStatus(plant: Plant, loc: Location | null, now = Date.now()): { due: boolean; note: string } | null {
  if (!plant.potted) return null;
  const g = guideFor(plant.guideKey, plant.species);
  const since = plant.lastRepotted ?? plant.createdAt;
  const months = (now - since) / (DAY * 30.4);
  const left = Math.ceil(g.repotMonths - months);
  if (left > 0) {
    return { due: false, note: left <= 1 ? 'Due for a bigger pot within the month.' : `Next repot in about ${left} months.` };
  }
  const season = seasonFor(loc, now);
  if (season === 'spring' || season === 'summer') {
    return { due: true, note: 'It has been in this pot a long while and it is the growing season, the best time to repot.' };
  }
  return { due: false, note: 'Ready for a bigger pot, but wait until spring when it is growing again.' };
}

export function tasksFor(plant: Plant, weather: Weather | null, loc: Location | null, now = Date.now()): Task[] {
  const g = guideFor(plant.guideKey, plant.species);
  const season = seasonFor(loc, now);
  const tasks: Task[] = [];

  for (const todo of plant.todos) {
    tasks.push({ id: `${plant.id}:todo:${todo.id}`, plantId: plant.id, kind: 'todo', title: todo.title, reason: todo.detail, dueIn: 0, todo });
  }

  // A water to-do from a check-in already covers the watering.
  if (!plant.todos.some((t) => t.kind === 'water')) {
    const w = waterPlan(plant, weather, loc, now);
    tasks.push({ id: `${plant.id}:water`, plantId: plant.id, kind: 'water', title: w.skipped ? 'Skip watering' : 'Water', reason: w.reason, dueIn: w.dueIn, skipped: w.skipped });
  }

  const repot = repotStatus(plant, loc, now);
  if (repot?.due && !plant.todos.some((t) => t.kind === 'repot')) {
    tasks.push({ id: `${plant.id}:repot`, plantId: plant.id, kind: 'repot', title: 'Repot', reason: repot.note + ' Go one pot size up with fresh potting mix.', dueIn: 0 });
  }

  const h = g.harvest;
  if (h && (!h.seasons || h.seasons.includes(season)) && !plant.todos.some((t) => t.kind === 'harvest')) {
    const dueIn = dayDiff((plant.lastHarvested ?? plant.createdAt) + 7 * DAY, now);
    tasks.push({
      id: `${plant.id}:harvest`, plantId: plant.id, kind: 'harvest',
      title: h.kind === 'continuous' ? 'Pick some' : 'Check for ripe ones',
      reason: h.how, dueIn,
    });
  }

  const lastLook = plant.checkins[0]?.date ?? plant.createdAt;
  tasks.push({
    id: `${plant.id}:photo`, plantId: plant.id, kind: 'photo', title: 'Weekly photo',
    reason: 'Take a photo and note what you see, so problems get caught early.',
    dueIn: dayDiff(lastLook + 7 * DAY, now),
  });

  return tasks;
}

const ORDER: Record<Task['kind'], number> = { todo: 0, water: 1, harvest: 2, repot: 3, photo: 4 };

export function allTasks(plants: Plant[], weather: Weather | null, loc: Location | null, now = Date.now()): Task[] {
  return plants
    .flatMap((p) => tasksFor(p, weather, loc, now))
    .sort((a, b) => Math.max(a.dueIn, 0) - Math.max(b.dueIn, 0) || ORDER[a.kind] - ORDER[b.kind] || a.dueIn - b.dueIn);
}

export interface Alert {
  kind: 'frost' | 'heat';
  title: string;
  detail: string;
}

function listNames(names: string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

export function alertsFor(plants: Plant[], weather: Weather | null): Alert[] {
  const idx = todayIndex(weather);
  if (!weather || idx < 0) return [];
  const out: Alert[] = [];
  const soon = weather.days.slice(idx, idx + 3);
  const garden = plants.filter((p) => p.place === 'garden');

  const frost = soon.find((d) => d.tmin <= 2);
  const tender = garden.filter((p) => guideFor(p.guideKey, p.species).frostTender);
  if (frost && tender.length) {
    out.push({
      kind: 'frost',
      title: `Frost risk ${frost.date === weather.today ? 'tonight' : 'on ' + weekday(frost.date)} (${Math.round(frost.tmin)}°)`,
      detail: `Bring pots under cover or throw an old sheet over ${listNames(tender.map(plantName))} before dark.`,
    });
  }

  const heat = soon.find((d) => d.tmax >= 36);
  if (heat && garden.length) {
    out.push({
      kind: 'heat',
      title: `Heatwave ${heat.date === weather.today ? 'today' : 'on ' + weekday(heat.date)} (${Math.round(heat.tmax)}°)`,
      detail: 'Water deeply early in the morning, move pots into shade, and do not fertilise or prune until it cools.',
    });
  }
  return out;
}

export function dueLabel(dueIn: number): string {
  if (dueIn < -1) return `${-dueIn} days late`;
  if (dueIn === -1) return 'Since yesterday';
  if (dueIn === 0) return 'Today';
  if (dueIn === 1) return 'Tomorrow';
  return `In ${dueIn} days`;
}

export function ago(t: number, now = Date.now()): string {
  const d = dayDiff(now, t);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d > 300 ? 'numeric' : undefined });
}
