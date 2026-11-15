// Photo help. Requests wait in the household's queue until the helper
// (running on a home computer, see helper/helper.mjs) answers them.
import * as remote from './sync';
import type { House } from './sync';
import type { Category } from './types';

export type AIKind = 'identify' | 'tag' | 'diagnose' | 'ask';

export interface Identified {
  name: string;
  latin?: string;
  category?: Category;
  /** Key of the known plant whose care is closest. */
  careLike?: string;
  confidence?: 'high' | 'medium' | 'low';
}
export interface TagRead {
  name?: string;
  light?: string;
  water?: string;
  size?: string;
  feeding?: string;
  notes?: string;
}
export interface Finding {
  title: string;
  detail: string;
  action: 'water' | 'hold' | 'repot' | 'feed' | 'prune' | 'harvest' | 'care' | 'good';
}
export interface Diagnosis {
  summary: string;
  health: 'good' | 'watch' | 'poor';
  findings: Finding[];
}
export interface Answer {
  answer: string;
}

type Why = 'nohouse' | 'setup' | 'offline' | 'busy' | 'timeout' | 'failed';
export class AIError extends Error {
  why: Why;
  constructor(why: Why) { super(why); this.why = why; }
}

const MESSAGE: Record<Why, string> = {
  nohouse: 'Photo help works once you have set up a household.',
  setup: 'Photo help is not set up yet.',
  offline: 'The Plant Parenthood helper is not running on the home computer right now, so nobody is there to look. Try again when it is on.',
  busy: 'Too many requests are waiting. Give it a minute and try again.',
  timeout: 'That took too long. Try again in a moment.',
  failed: 'That did not work this time. Try again, ideally with a sharper, brighter photo.',
};
export const aiMessage = (e: unknown) => MESSAGE[e instanceof AIError ? e.why : 'failed'];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function house(): House | null {
  try { return JSON.parse(localStorage.getItem('sprout.house') ?? 'null') as House | null; } catch { return null; }
}
export const aiAvailable = () => remote.syncAvailable && !!house();

export async function runAI<T>(kind: AIKind, input: object, photo?: string): Promise<T> {
  const h = house();
  if (!h || !remote.syncAvailable) throw new AIError('nohouse');
  let id: string | null;
  try { id = await remote.ask(h.code, kind, input, photo ?? null); } catch { throw new AIError('setup'); }
  if (!id) throw new AIError('busy');

  const start = Date.now();
  while (Date.now() - start < 150000) {
    await wait(1500);
    const a = await remote.answer(h.code, id).catch(() => null);
    if (!a) continue;
    if (a.status === 'done' && a.result) return a.result as T;
    if (a.status === 'failed') throw new AIError('failed');
    if (a.status === 'pending' && !a.helper && Date.now() - start > 10000) throw new AIError('offline');
  }
  throw new AIError('timeout');
}
