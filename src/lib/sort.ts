// Ordering the plant list: by name, age, or by when each job is next due.
import { DAY, dayDiff, dueLabel, feedPlan, plantName, repotStatus, seasonFor, waterPlan } from './care';
import { bornAt } from './age';
import { guideFor } from './guide';
import type { Category, Guide, Location, Plant, Season, Weather } from './types';

export type SortKey = 'az' | 'water' | 'age' | 'prune' | 'repot' | 'feed' | 'harvest' | 'propagate' | 'move';

export const SORTS: { value: SortKey; label: string }[] = [
  { value: 'az', label: 'A–Z' },
  { value: 'water', label: 'Water' },
  { value: 'age', label: 'Age' },
  { value: 'prune', label: 'Prune' },
  { value: 'repot', label: 'Resoil' },
  { value: 'feed', label: 'Fertilise' },
  { value: 'harvest', label: 'Harvest' },
  { value: 'propagate', label: 'Propagate' },
  { value: 'move', label: 'Move' },
];

/** When the job is next due, and the short label for the plant's chip. `never` sorts last. */
export interface Due { dueIn: number; label: string; urgent: boolean; never?: boolean }

const NEVER = (label: string): Due => ({ dueIn: Infinity, label, urgent: false, never: true });

/** Days until the season is next one of these (0 if it is now). */
function daysUntil(seasons: Season[], loc: Location | null, now: number): number {
  for (let d = 0; d < 370; d += 1) if (seasons.includes(seasonFor(loc, now + d * DAY))) return d;
  return Infinity;
}

function due(dueIn: number, now = 'Now'): Due {
  if (dueIn <= 0) return { dueIn, label: now, urgent: true };
  if (dueIn > 45) {
    const m = Math.round(dueIn / 30.4);
    return { dueIn, label: m <= 1 ? 'Next month' : `In ${m} months`, urgent: false };
  }
  return { dueIn, label: dueLabel(dueIn), urgent: false };
}

// The usual time of year for each job. Plants differ, so this is the general rule for the type.
const PRUNE: Record<Category, Season[]> = {
  herb: ['spring', 'summer'], // pinch the tips to keep it bushy
  vegetable: ['summer'], // pinch out side shoots and dead leaves
  fruit: ['winter'], // the main prune while dormant
  houseplant: ['spring'],
  succulent: ['spring'],
  flower: ['summer'], // deadhead to keep flowers coming
  shrub: ['winter'], // late winter, before new growth
};
// Plenty of plants never need pruning: bulbs, palms, ferns, most houseplants, succulents and veg,
// leafy herbs you just pick, and big trees. For a type, the rule is the usual case; these are the exceptions.
const PRUNE_YES: Partial<Record<Category, RegExp>> = {
  houseplant: /ficus|fig\b|fiddle|rubber|croton|persian|pothos|tradescantia|coleus|schefflera|umbrella|dracaena|ivy|begonia|geranium|fuchsia|polka/,
  vegetable: /tomato|tomatillo/,
  succulent: /(?!)/,
};
const PRUNE_NO: Partial<Record<Category, RegExp>> = {
  herb: /parsley|coriander|cilantro|chervil|dill|borage|chives|ginger|turmeric|cumin|caraway|angelica|cardamom|wasabi|horseradish|nasturtium|lovage|fennel|garlic|galangal/,
  fruit: /strawberr|melon|pineapple|macadamia|avocado|jaboticaba|mangosteen|babaco|pumpkin|gooseberry/,
  flower: /tulip|hyacinth|freesia|crocus|ranunculus|lily|tuberose|cyclamen|sunflower|foxglove|hollyhock|canterbury|violet|daffodil|jonquil|narcissus|iris|anemone|snowdrop|bluebell|gladiol|orchid|zygopetalum|bulb/,
  shrub: /jarrah|gum|eucalypt|jacaranda|maple|firewheel|daphne|cycad|grass-tree|xanthorrhoea|magnolia|frangipani|bottle-tree|boab|kurrajong|she-oak|casuarina|tree-fern/,
};
const PRUNE_BY_DEFAULT: Record<Category, boolean> = { herb: true, vegetable: false, fruit: true, houseplant: false, succulent: false, flower: true, shrub: true };

/** Whether this kind of plant is ever pruned. Picking herbs and deadheading count; tidying off a dead leaf does not. */
export function needsPruning(g: Guide): boolean {
  const id = `${g.key} ${g.name}`.toLowerCase();
  if (/palm|\bfern\b|cactus|bromeliad|air-plant|tillandsia|moss/.test(id)) return false;
  if (PRUNE_BY_DEFAULT[g.category]) return !PRUNE_NO[g.category]?.test(id);
  return !!PRUNE_YES[g.category]?.test(id);
}

// Matches the feeding seasons in care.ts.
const FEED_SEASONS: Record<Category, Season[]> = {
  herb: ['spring', 'summer', 'autumn'], vegetable: ['spring', 'summer', 'autumn'], fruit: ['spring', 'summer', 'autumn'],
  flower: ['spring', 'summer', 'autumn'], houseplant: ['spring', 'summer'], succulent: ['spring', 'summer'], shrub: ['spring', 'summer'],
};
const PROPAGATE: Record<Category, Season[] | null> = {
  herb: ['spring', 'summer'],
  vegetable: null, // grown fresh from seed
  fruit: ['winter'], // hardwood cuttings
  houseplant: ['spring', 'summer'],
  succulent: ['spring', 'summer'],
  flower: ['spring'],
  shrub: ['autumn'], // semi-hardwood cuttings
};

export function dueFor(key: SortKey, p: Plant, weather: Weather | null, loc: Location | null, now = Date.now()): Due | null {
  const g = guideFor(p.guideKey, p.species);
  switch (key) {
    case 'az': return null;
    case 'age': {
      const days = dayDiff(now, bornAt(p, now));
      const label = days < 1 ? (p.age ? 'Sown today' : 'Added today') : days < 60 ? `${days} day${days === 1 ? '' : 's'} old` : days < 730 ? `${Math.round(days / 30.4)} months old` : `${Math.floor(days / 365)} years old`;
      return { dueIn: -days, label, urgent: false };
    }
    case 'water': {
      const w = waterPlan(p, weather, loc, now);
      if (w.skipped) return { dueIn: w.dueIn, label: 'Rain coming', urgent: false };
      return due(w.dueIn, 'Today');
    }
    case 'feed': {
      const f = feedPlan(p, loc, now);
      if (!f.inSeason) {
        const s = daysUntil(FEED_SEASONS[g.category], loc, now);
        return { ...due(s), label: s > 45 ? `From ${seasonFor(loc, now + s * DAY)}` : due(s).label };
      }
      return due(f.dueIn, 'Today');
    }
    case 'repot': {
      if (!p.potted) return NEVER('In the ground');
      const r = repotStatus(p, loc, now);
      if (r?.due) return due(0);
      const left = (p.lastRepotted ?? p.createdAt) + g.repotMonths * 30.4 * DAY;
      const ready = Math.max(0, dayDiff(left, now));
      return due(Math.max(ready, daysUntil(['spring', 'summer'], loc, now + ready * DAY) + ready));
    }
    case 'harvest': {
      const h = g.harvest;
      if (!h) return NEVER('Not for picking');
      if (p.todos.some((t) => t.kind === 'harvest')) return due(0);
      const wait = h.seasons ? daysUntil(h.seasons, loc, now) : 0;
      if (wait > 0) return due(wait);
      return due(dayDiff((p.lastHarvested ?? p.createdAt) + 7 * DAY, now));
    }
    case 'prune': {
      if (p.todos.some((t) => t.kind === 'prune')) return due(0);
      if (!needsPruning(g)) return NEVER("Don't prune");
      return due(daysUntil(PRUNE[g.category], loc, now));
    }
    case 'propagate': {
      const s = PROPAGATE[g.category];
      if (!s) return NEVER('Grow from seed');
      return due(daysUntil(s, loc, now));
    }
    case 'move': {
      if (p.place === 'garden' && !p.potted) return NEVER('Stays put');
      const soon = weather ? weather.days.slice(Math.max(0, weather.days.findIndex((d) => d.date === weather.today))).slice(0, 3) : [];
      if (p.place === 'garden') {
        const hot = soon.findIndex((d) => d.tmax >= 36);
        const frost = g.frostTender ? soon.findIndex((d) => d.tmin <= 2) : -1;
        if (frost >= 0) return { dueIn: frost, label: frost === 0 ? 'Cover tonight' : 'Frost soon', urgent: true };
        if (hot >= 0) return { dueIn: hot, label: hot === 0 ? 'Into shade' : 'Heat soon', urgent: true };
        if (g.frostTender) {
          const d = daysUntil(['winter'], loc, now);
          return d === 0 ? { dueIn: 0, label: 'Under cover', urgent: true } : due(d);
        }
        return NEVER('Fine outside');
      }
      // Indoor plants enjoy a summer holiday outside in a shady spot.
      return { ...due(daysUntil(['summer'], loc, now), 'Outside OK'), urgent: false };
    }
  }
}

export function sortPlants(plants: Plant[], key: SortKey, weather: Weather | null, loc: Location | null, now = Date.now()): Plant[] {
  const byName = (a: Plant, b: Plant) => plantName(a).localeCompare(plantName(b));
  if (key === 'az') return [...plants].sort(byName);
  const due = new Map(plants.map((p) => [p.id, dueFor(key, p, weather, loc, now)!]));
  return [...plants].sort((a, b) => {
    const x = due.get(a.id)!.dueIn, y = due.get(b.id)!.dueIn;
    return x === y ? byName(a, b) : x < y ? -1 : 1;
  });
}

const KEY = 'sprout.sort';
export function savedSort(): SortKey {
  try { const v = localStorage.getItem(KEY) as SortKey | null; return v && SORTS.some((s) => s.value === v) ? v : 'az'; } catch { return 'az'; }
}
export function saveSort(k: SortKey) { try { localStorage.setItem(KEY, k); } catch { /* private mode */ } }
