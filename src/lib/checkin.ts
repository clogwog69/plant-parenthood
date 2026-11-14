import { DAY, dayDiff } from './care';
import { guideFor } from './guide';
import type { Advice, Plant, Sign, Todo } from './types';

export interface SignOption {
  sign: Sign;
  label: string;
  group: 'Soil' | 'Leaves' | 'Growth' | 'Pot';
  pottedOnly?: boolean;
}

export const SIGNS: SignOption[] = [
  { sign: 'soil_dry', label: 'Soil is dry', group: 'Soil' },
  { sign: 'soil_soggy', label: 'Soil is soggy', group: 'Soil' },
  { sign: 'wilting', label: 'Drooping', group: 'Leaves' },
  { sign: 'yellow', label: 'Yellow leaves', group: 'Leaves' },
  { sign: 'brown_tips', label: 'Brown, crispy tips', group: 'Leaves' },
  { sign: 'spots', label: 'Spots or white powder', group: 'Leaves' },
  { sign: 'pests', label: 'Bugs or chewed leaves', group: 'Leaves' },
  { sign: 'new_growth', label: 'New growth', group: 'Growth' },
  { sign: 'flowering', label: 'Flowers or buds', group: 'Growth' },
  { sign: 'fruit_ready', label: 'Looks ready to pick', group: 'Growth' },
  { sign: 'leggy', label: 'Tall and leggy', group: 'Growth' },
  { sign: 'roots_out', label: 'Roots poking out', group: 'Pot', pottedOnly: true },
  { sign: 'top_heavy', label: 'Too big for its pot', group: 'Pot', pottedOnly: true },
];

export const SIGN_LABEL = Object.fromEntries(SIGNS.map((s) => [s.sign, s.label])) as Record<Sign, string>;
SIGN_LABEL.looks_great = 'Looks healthy';

const REPOT =
  'Move it into a pot one size up (3 to 5 cm wider) with fresh potting mix. Tease the outer roots loose, plant at the same depth, and water it in well.';

export function adviceFor(plant: Plant, signs: Sign[], now = Date.now()): Advice[] {
  const g = guideFor(plant.guideKey, plant.species);
  const has = (s: Sign) => signs.includes(s);
  const own = (s: Sign, fallback: string) => g.signs?.[s] ?? fallback;
  const out: Advice[] = [];
  const add = (sign: Sign, kind: Advice['kind'], title: string, detail: string) => out.push({ sign, kind, title, detail });

  const likesDry = g.waterDays >= 14;
  const sinceWater = plant.lastWatered ? dayDiff(now, plant.lastWatered) : 99;

  if (has('wilting') && has('soil_soggy')) {
    add('wilting', 'care', 'Drooping in wet soil', 'That points to roots struggling for air, not thirst. Stop watering, tip out any water in the saucer, and check the drainage holes are clear. If it smells sour, repot into fresh dry mix and trim away any brown mushy roots.');
  } else if (has('wilting')) {
    add('wilting', 'water', 'Water it now', own('wilting', 'Drooping usually means thirsty. Water slowly until it runs out the bottom. It should perk up within a few hours; if it does not, check that the roots are not sitting in water.'));
  } else if (has('soil_dry')) {
    if (likesDry && sinceWater < g.waterDays) {
      add('soil_dry', 'good', 'Dry soil is fine', own('soil_dry', 'This one likes to dry out completely between drinks. Leave it a little longer.'));
    } else {
      add('soil_dry', 'water', 'Give it a good drink', own('soil_dry', 'Water slowly at the base until it runs out the bottom, then let it drain. A deep soak beats a daily sprinkle.'));
    }
  }

  if (has('soil_soggy') && !has('wilting')) {
    add('soil_soggy', 'hold', 'Hold off watering', own('soil_soggy', 'Let the top few centimetres dry out before watering again. Empty the saucer and make sure the pot can drain. I will push the next watering back a few days.'));
  }

  if (has('yellow')) {
    add('yellow', 'care', 'Yellow leaves', own('yellow', 'Most often this is too much water: check the soil is not staying wet. If the soil is fine and it is the oldest leaves, the plant is hungry, so give it a liquid feed. Snip the yellow leaves off.'));
  }
  if (has('brown_tips')) {
    add('brown_tips', 'care', 'Brown, crispy tips', own('brown_tips', 'Usually a sign it dried out too far at some point, or of dry air or harsh sun. Water more evenly, move it out of hot afternoon sun, and trim the brown bits off with clean scissors.'));
  }
  if (has('spots')) {
    add('spots', 'care', 'Spots on the leaves', own('spots', 'Likely a fungal problem. Remove the affected leaves and bin them (not the compost), water the soil rather than the leaves, and give the plant more airflow.'));
  }
  if (has('pests')) {
    add('pests', 'care', 'Deal with the pests', own('pests', 'Look under the leaves. Pick off caterpillars and snails by hand, and hose off aphids. For anything stubborn, spray with soapy water or neem oil in the evening and repeat in a week.'));
  }

  if (has('flowering')) {
    const leafy = g.category === 'vegetable' && g.harvest?.kind === 'continuous';
    if (leafy) add('flowering', 'harvest', 'Going to seed: harvest now', own('flowering', 'Leafy crops turn bitter once they flower. Pick what you can use now.'));
    else if (g.category === 'herb') add('flowering', 'prune', 'Flowering: cut it back', own('flowering', 'Pinch the flower heads off just above a pair of leaves to keep the plant making leaves.'));
    else if (g.category === 'vegetable' || g.category === 'fruit') add('flowering', 'care', 'Flowers are out', own('flowering', 'Flowers mean a crop is on the way. Keep the watering steady and feed every two weeks with a fruit and flower fertiliser.'));
    else add('flowering', 'good', 'In flower', own('flowering', 'Enjoy it. Snip off blooms as they fade to keep more coming.'));
  }
  if (has('fruit_ready')) {
    add('fruit_ready', 'harvest', 'Ready to pick', g.harvest?.how ?? 'Pick it while it is at its best. Use scissors or secateurs rather than pulling.');
  }
  if (has('leggy')) {
    add('leggy', 'prune', 'Trim it back', own('leggy', 'Long gaps between leaves mean it is reaching for light. Move it somewhere brighter and cut the stems back by a third, just above a leaf, so it bushes out.'));
  }
  if (plant.potted && (has('roots_out') || has('top_heavy'))) {
    const s: Sign = has('roots_out') ? 'roots_out' : 'top_heavy';
    add(s, 'repot', 'Needs a bigger pot', own(s, has('roots_out') ? 'Roots coming out of the bottom mean it has run out of room. ' + REPOT : 'A plant this size dries out quickly and tips over in a small pot. ' + REPOT));
  }
  if (has('new_growth')) {
    add('new_growth', 'good', 'New growth', 'It is happy where it is. This is a good time for a light liquid feed.');
  }
  if (!out.length) {
    add('looks_great', 'good', 'Looking healthy', 'Nothing to fix. Keep doing what you are doing.');
  }
  return out;
}

const TODO_KINDS: Advice['kind'][] = ['water', 'repot', 'harvest', 'prune', 'care'];

/** Turn check-in advice into follow-up jobs on the plant. */
export function applyAdvice(plant: Plant, advice: Advice[], uid: () => string, now = Date.now()): Plant {
  const todos: Todo[] = [...plant.todos];
  let holdWaterUntil = plant.holdWaterUntil;
  for (const a of advice) {
    if (a.kind === 'hold' || (a.sign === 'wilting' && a.kind === 'care')) holdWaterUntil = now + 4 * DAY;
    if (TODO_KINDS.includes(a.kind) && !todos.some((t) => t.title === a.title)) {
      todos.push({ id: uid(), kind: a.kind, title: a.title, detail: a.detail, createdAt: now });
    }
  }
  return { ...plant, todos, holdWaterUntil };
}
