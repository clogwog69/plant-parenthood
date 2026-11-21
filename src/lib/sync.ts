import { SUPABASE_KEY, SUPABASE_URL } from './config';
import type { Location, Photo, Plant } from './types';

export const syncAvailable = !!(SUPABASE_URL && SUPABASE_KEY);

export interface House { code: string; name: string }
export interface Pulled {
  now: string;
  location: Location | null;
  plants: { id: string; data: Plant | null; deleted: boolean }[];
}
export interface PushRow { id: string; data: Plant | null; deleted: boolean }

async function rpc<T>(fn: string, args: object): Promise<T> {
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`sync ${res.status}`);
  return (await res.json()) as T;
}

export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const prettyCode = (c: string) => `${c.slice(0, 5)}-${c.slice(5)}`;

export const createHouse = (name: string) => rpc<House>('sprout_create', { p_name: name });
export const joinHouse = (code: string) => rpc<House | null>('sprout_join', { p_code: cleanCode(code) });
export const pull = (code: string, since: string | null) => rpc<Pulled | null>('sprout_pull', { p_code: code, p_since: since });
export const push = (code: string, plants: PushRow[]) => rpc<boolean>('sprout_push', { p_code: code, p_plants: plants });
export const setLocation = (code: string, location: Location | null) => rpc<boolean>('sprout_set_location', { p_code: code, p_location: location });
export const putPhoto = (code: string, p: Photo) => rpc<boolean>('sprout_put_photo', { p_code: code, p_id: p.id, p_plant: p.plantId, p_data: p.dataUrl });
export const getPhoto = (code: string, id: string) => rpc<Omit<Photo, 'id'> | null>('sprout_get_photo', { p_code: code, p_id: id });

// --- Morning summary, photo help and notifications ---

export class SetupError extends Error {}

export const setDigest = (code: string, digest: unknown) => rpc<boolean>('sprout_set_digest', { p_code: code, p_digest: digest });
export const ask = (code: string, kind: string, input: object, photo: string | null) =>
  rpc<string | null>('sprout_ask', { p_code: code, p_kind: kind, p_input: input, p_photo: photo });
export const answer = (code: string, id: string) =>
  rpc<{ status: 'pending' | 'working' | 'done' | 'failed'; result: unknown; helper: boolean } | null>('sprout_answer', { p_code: code, p_id: id });

/** Calls the "push" edge function, which sends the notifications. */
export async function pushFn<T>(body: object): Promise<T> {
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/push`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new SetupError(`push ${res.status}`);
  return (await res.json()) as T;
}

// --- Plant sitters: someone minding the plants while the household is away ---

export interface Sitter { token: string; name: string; email: string | null; starts: string; ends: string }
export interface SitView { name: string; starts: string; ends: string; house: string; location: Location | null; plants: Plant[] }

export const addSitter = (code: string, name: string, email: string, starts: string, ends: string) =>
  rpc<string | null>('sprout_add_sitter', { p_code: code, p_name: name, p_email: email, p_starts: starts, p_ends: ends });
export const listSitters = (code: string) => rpc<Sitter[]>('sprout_list_sitters', { p_code: code });
export const removeSitter = (code: string, token: string) => rpc<boolean>('sprout_remove_sitter', { p_code: code, p_token: token });
export const sitPull = (token: string) => rpc<SitView | null>('sprout_sit_pull', { p_token: token });
export const sitWater = (token: string, plant: string) => rpc<Plant | null>('sprout_sit_water', { p_token: token, p_plant: plant });
export const sitLink = (token: string) => `${location.origin}${location.pathname}#/sit/${token}`;
