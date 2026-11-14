import { guideFor } from './guide';
import type { Category, Location, Plant, Season, Task, Weather } from './types';

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

const GROW: Season[] = ['spring', 'summer'];
const GROW_LONG: Season[] = ['spring', 'summer', 'autumn'];
const FEED: Record<Category, { weeks: number; seasons: Season[]; what: string }> = {
  herb: { weeks: 4, seasons: GROW_LONG, what: 'Liquid fertiliser or seaweed tonic at half strength, poured on damp soil. Too much makes herbs soft and less tasty.' },
  vegetable: { weeks: 2, seasons: GROW_LONG, what: 'Liquid vegetable fertiliser. Switch to a tomato or fruit feed (high in potassium) once it flowers.' },
  fruit: { weeks: 6, seasons: GROW_LONG, what: 'Citrus and fruit fertiliser scattered around the edge of the canopy, then watered in well.' },
  houseplant: { weeks: 4, seasons: GROW, what: 'Liquid indoor plant food at half the strength on the bottle, on soil that is already damp.' },
  succulent: { weeks: 8, seasons: GROW, what: 'Cactus and succulent feed at half strength. They need very little.' },
  flower: { weeks: 3, seasons: GROW_LONG, what: 'Liquid flower fertiliser (high in potassium) to keep the blooms coming.' },
  shrub: { weeks: 12, seasons: GROW, what: 'Slow-release granules scattered under the canopy and watered in.' },
};

export interface FeedPlan {
  /** False outside the growing season, when feeding does more harm than good. */
  inSeason: boolean;
  dueIn: number;
  weeks: number;
  what: string;
  note: string;
}

export function feedPlan(plant: Plant, loc: Location | null, now = Date.now()): FeedPlan {
  const g = guideFor(plant.guideKey, plant.species);
  const f = FEED[g.category];
  const every = f.weeks * 7 * DAY;
  const inSeason = f.seasons.includes(seasonFor(loc, now));
  // Fresh potting mix carries a couple of weeks of food.
  const last = plant.lastFed ?? plant.createdAt + 14 * DAY - every;
  const dueIn = Math.max(0, dayDiff(last + every, now));
  const rhythm = `every ${f.weeks === 1 ? 'week' : `${f.weeks} weeks`}`;
  const note = !inSeason
    ? `No feeding until ${f.seasons[0]}. It is resting, and fertiliser now just builds up in the soil.`
    : dueIn <= 0
      ? `Time for a feed. It likes one ${rhythm} while it is growing.`
      : `Next feed ${dueLabel(dueIn).toLowerCase()}, then ${rhythm} while it is growing.`;
  return { inSeason, dueIn, weeks: f.weeks, what: f.what, note };
}

export interface Spot {
  title: string;
  detail: string;
}

/** Where to put it: which window indoors, how much sun or shade outside. */
export function placement(plant: Pick<Plant, 'guideKey' | 'species' | 'place' | 'potted'>, loc: Location | null): Spot {
  const g = guideFor(plant.guideKey, plant.species);
  const l = g.light.toLowerCase();
  const sunny = isSouthern(loc) ? 'north' : 'south';
  const level = /no direct/.test(l) ? 'shade'
    : /low/.test(l) ? 'low'
    : /indirect/.test(l) ? 'indirect'
    : /direct sun|bright light|bright as/.test(l) ? 'some'
    : /^(morning sun|part shade)|cool weather/.test(l) ? 'part'
    : /part shade/.test(l) ? 'flex'
    : 'full';
  const extra: string[] = [];

  if (plant.place === 'indoor') {
    extra.push('Keep it away from heaters, air conditioners and cold draughts.');
    const spot: Spot =
      level === 'full' ? { title: 'Your sunniest window', detail: `Right on the sill of a ${sunny}-facing window, where it gets several hours of direct sun. Anywhere dimmer and it grows thin and leggy.` }
      : level === 'some' ? { title: 'A bright windowsill', detail: `Beside an east or ${sunny}-facing window with a few hours of gentle direct sun, ideally in the morning.` }
      : level === 'part' || level === 'flex' ? { title: 'Next to a bright window', detail: 'Within a metre of an east-facing window: morning sun, then bright shade for the rest of the day.' }
      : level === 'low' ? { title: 'Almost anywhere indoors', detail: 'It copes with a hallway, bathroom or a corner a few metres from a window. It grows faster with more light, so move it closer if it sulks.' }
      : { title: 'Bright, but out of the sunbeams', detail: `One to two metres back from a ${sunny} or east-facing window, or behind a sheer curtain. Direct sun through glass scorches the leaves.` };
    return { title: spot.title, detail: [spot.detail, ...extra].join(' ') };
  }

  if (/wind/.test(l)) extra.push('Pick somewhere sheltered from strong wind.');
  if (plant.potted) extra.push('Pots heat up fast, so slide it into shade during a heatwave.');
  if (g.frostTender) extra.push('Move it under cover when frost is forecast.');
  const spot: Spot =
    level === 'full' ? { title: 'Full sun', detail: `An open spot with 6 or more hours of direct sun, on the ${sunny} side of the house or fence.` }
    : level === 'flex' ? { title: 'Sun or part shade', detail: 'Happy with 4 to 6 hours of sun. Where summers are hot, afternoon shade stops it scorching.' }
    : level === 'part' ? { title: 'Morning sun, afternoon shade', detail: 'The east side of the house or the edge of a tree, with 3 to 4 hours of sun before midday and shade after.' }
    : { title: 'Bright shade', detail: 'Under a verandah, pergola or tree canopy: bright, but with no midday or afternoon sun on the leaves.' };
  return { title: spot.title, detail: [spot.detail, ...extra].join(' ') };
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

  const feed = feedPlan(plant, loc, now);
  if (feed.inSeason) {
    tasks.push({ id: `${plant.id}:feed`, plantId: plant.id, kind: 'feed', title: 'Feed', reason: feed.what, dueIn: feed.dueIn });
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

const ORDER: Record<Task['kind'], number> = { todo: 0, water: 1, harvest: 2, feed: 3, repot: 4, photo: 5 };

export function allTasks(plants: Plant[], weather: Weather | null, loc: Location | null, now = Date.now()): Task[] {
  return plants
    .flatMap((p) => tasksFor(p, weather, loc, now))
    .sort((a, b) => Math.max(a.dueIn, 0) - Math.max(b.dueIn, 0) || ORDER[a.kind] - ORDER[b.kind] || a.dueIn - b.dueIn);
}

export interface DigestDay {
  date: string; // YYYY-MM-DD, local
  items: string[];
}

const isoDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The next week of jobs, in words, for the morning notification. */
export function digest(plants: Plant[], weather: Weather | null, loc: Location | null, now = Date.now()): DigestDay[] {
  const tasks = allTasks(plants, weather, loc, now).filter((t) => !t.skipped && t.kind !== 'photo');
  const names = new Map(plants.map((p) => [p.id, plantName(p)]));
  const days: DigestDay[] = [];
  for (let d = 0; d < 7; d++) {
    const items = tasks
      .filter((t) => t.dueIn <= d)
      .map((t) => (t.kind === 'water' || t.kind === 'feed' || t.kind === 'repot' ? `${t.title} ${names.get(t.plantId)}` : `${names.get(t.plantId)}: ${t.title.toLowerCase()}`));
    days.push({ date: isoDay(now + d * DAY), items: items.slice(0, 12) });
  }
  return days;
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
