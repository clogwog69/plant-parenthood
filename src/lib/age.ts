// How grown-up a plant is. Babies have tiny roots, dry out fast and should not be fed or picked yet.
import type { Plant, Stage } from './types';

const DAY = 86_400_000;

export const STAGES: { value: Stage; label: string; hint: string }[] = [
  { value: 'seed', label: 'Seeds just sown', hint: 'Nothing up yet' },
  { value: 'seedling', label: 'Seedling', hint: 'A few small leaves' },
  { value: 'young', label: 'Young plant', hint: 'Growing, but still small' },
  { value: 'grown', label: 'Fully grown', hint: 'Settled and established' },
];
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.value, s.label])) as Record<Stage, string>;

// Roughly how long each stage lasts, and how old a plant is when it starts it.
const START: Record<Stage, number> = { seed: 0, seedling: 14, young: 56, grown: 240 };

/** About how many days old the plant is now. */
export function ageDays(p: Pick<Plant, 'age' | 'createdAt'>, now = Date.now()): number | null {
  if (!p.age) return null;
  return START[p.age.stage] + Math.max(0, (now - p.age.at) / DAY);
}

/** What stage it is at now. Plants grow up, so a seedling marked in spring is a young plant by summer. */
export function stageOf(p: Pick<Plant, 'age' | 'createdAt'>, now = Date.now()): Stage | null {
  const d = ageDays(p, now);
  if (d === null) return null;
  return d >= START.grown ? 'grown' : d >= START.young ? 'young' : d >= START.seedling ? 'seedling' : 'seed';
}

/** When it was about born. Without an age, the day it was added. */
export function bornAt(p: Pick<Plant, 'age' | 'createdAt'>, now = Date.now()): number {
  const d = ageDays(p, now);
  return d === null ? p.createdAt : now - d * DAY;
}

/** How much more often to water than a grown plant. */
export const WATER_FACTOR: Record<Stage, number> = { seed: 0.25, seedling: 0.35, young: 0.65, grown: 1 };

export const WATER_WHY: Record<Stage, string> = {
  seed: 'Seeds must never dry out, so keep the top of the soil damp with a gentle sprinkle or mist',
  seedling: 'Seedlings have tiny roots and dry out fast, so water a little and often',
  young: 'It is still young with small roots, so it needs water more often than a grown plant',
  grown: '',
};

const ORDER: Stage[] = ['seed', 'seedling', 'young', 'grown'];
export const isStage = (s: unknown): s is Stage => ORDER.includes(s as Stage);

/**
 * What a photo says about its age. Fills it in when nobody has said, and moves it on when it has grown
 * faster than the app guessed. Never makes it younger: plants do not shrink, and a bad photo should not undo it.
 */
export function ageFromPhoto(p: Pick<Plant, 'age' | 'createdAt'>, seen: unknown, now = Date.now()): Plant['age'] | null {
  if (!isStage(seen)) return null;
  const cur = stageOf(p, now);
  if (cur && ORDER.indexOf(seen) <= ORDER.indexOf(cur)) return null;
  return { stage: seen, at: now, fromPhoto: true };
}
