import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { adviceFor, applyAdvice } from './lib/checkin';
import * as db from './lib/db';
import type { Shot } from './lib/photo';
import type { Checkin, EventType, Location, Place, Plant, Sign, Weather } from './lib/types';
import { getWeather } from './lib/weather';

export type View = 'grid' | 'list';

export interface NewPlant {
  guideKey: string;
  species: string;
  nickname?: string;
  place: Place;
  potted: boolean;
  lastWatered?: number;
  shot?: Shot;
}

interface Store {
  ready: boolean;
  plants: Plant[];
  location: Location | null;
  weather: Weather | null;
  weatherFailed: boolean;
  view: View;
  setView(v: View): void;
  setLocation(l: Location | null): void;
  addPlant(p: NewPlant): Plant;
  removePlant(id: string): void;
  log(id: string, type: Exclude<EventType, 'added'>): void;
  completeTodo(id: string, todoId: string): void;
  checkIn(id: string, signs: Sign[], note: string, shot?: Shot): Checkin | null;
}

const Ctx = createContext<Store>(null as unknown as Store);
export const useStore = () => useContext(Ctx);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ }
}

const STAMP: Record<Exclude<EventType, 'added'>, 'lastWatered' | 'lastRepotted' | 'lastHarvested'> = {
  watered: 'lastWatered',
  repotted: 'lastRepotted',
  harvested: 'lastHarvested',
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [ready, setReady] = useState(false);
  const [location, setLoc] = useState<Location | null>(() => read('sprout.location', null));
  const [view, setV] = useState<View>(() => read('sprout.view', 'grid'));
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherFailed, setFailed] = useState(false);
  const ref = useRef<Plant[]>([]);

  const commit = useCallback((next: Plant[]) => {
    ref.current = next;
    setPlants(next);
  }, []);

  useEffect(() => {
    db.allPlants()
      .then((p) => commit(p.sort((a, b) => a.createdAt - b.createdAt)))
      .catch(() => {})
      .finally(() => setReady(true));
  }, [commit]);

  useEffect(() => {
    if (!location) { setWeather(null); return; }
    let off = false;
    const load = () => {
      getWeather(location)
        .then((w) => { if (!off) { setWeather(w); setFailed(false); } })
        .catch(() => { if (!off) setFailed(true); });
    };
    load();
    const onShow = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { off = true; document.removeEventListener('visibilitychange', onShow); };
  }, [location]);

  const patch = useCallback((id: string, fn: (p: Plant) => Plant): Plant | null => {
    const old = ref.current.find((p) => p.id === id);
    if (!old) return null;
    const next = fn(old);
    commit(ref.current.map((p) => (p.id === id ? next : p)));
    void db.putPlant(next);
    return next;
  }, [commit]);

  const store = useMemo<Store>(() => ({
    ready, plants, location, weather, weatherFailed, view,
    setView(v) { setV(v); write('sprout.view', v); },
    setLocation(l) { setLoc(l); write('sprout.location', l); },

    addPlant(n) {
      const now = Date.now();
      const id = uid();
      const photoId = n.shot ? uid() : undefined;
      const plant: Plant = {
        id, guideKey: n.guideKey, species: n.species, nickname: n.nickname || undefined,
        place: n.place, potted: n.potted, createdAt: now,
        thumb: n.shot?.thumb, photoId, lastWatered: n.lastWatered,
        todos: [], checkins: [], events: [{ type: 'added', date: now }],
      };
      if (n.shot && photoId) void db.putPhoto({ id: photoId, plantId: id, date: now, dataUrl: n.shot.full });
      commit([...ref.current, plant]);
      void db.putPlant(plant);
      return plant;
    },

    removePlant(id) {
      commit(ref.current.filter((p) => p.id !== id));
      void db.deletePlant(id);
      void db.deletePhotosFor(id);
    },

    log(id, type) {
      const now = Date.now();
      patch(id, (p) => ({
        ...p,
        [STAMP[type]]: now,
        holdWaterUntil: type === 'watered' ? undefined : p.holdWaterUntil,
        todos: p.todos.filter((t) => !(type === 'watered' && t.kind === 'water') && !(type === 'repotted' && t.kind === 'repot') && !(type === 'harvested' && t.kind === 'harvest')),
        events: [{ type, date: now }, ...p.events],
      }));
    },

    completeTodo(id, todoId) {
      const now = Date.now();
      patch(id, (p) => {
        const todo = p.todos.find((t) => t.id === todoId);
        const next: Plant = { ...p, todos: p.todos.filter((t) => t.id !== todoId) };
        if (todo?.kind === 'water') { next.lastWatered = now; next.holdWaterUntil = undefined; next.events = [{ type: 'watered', date: now }, ...p.events]; }
        if (todo?.kind === 'repot') { next.lastRepotted = now; next.events = [{ type: 'repotted', date: now }, ...p.events]; }
        if (todo?.kind === 'harvest') { next.lastHarvested = now; next.events = [{ type: 'harvested', date: now }, ...p.events]; }
        return next;
      });
    },

    checkIn(id, signs, note, shot) {
      const now = Date.now();
      let made: Checkin | null = null;
      patch(id, (p) => {
        const advice = adviceFor(p, signs, now);
        const photoId = shot ? uid() : undefined;
        if (shot && photoId) void db.putPhoto({ id: photoId, plantId: id, date: now, dataUrl: shot.full });
        made = { id: uid(), date: now, photoId, thumb: shot?.thumb, signs, advice, note: note.trim() || undefined };
        const withAdvice = applyAdvice(p, advice, uid, now);
        return {
          ...withAdvice,
          checkins: [made, ...p.checkins],
          thumb: shot?.thumb ?? p.thumb,
          photoId: photoId ?? p.photoId,
        };
      });
      return made;
    },
  }), [ready, plants, location, weather, weatherFailed, view, commit, patch]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

/** Loads a full-size photo from the phone's storage. */
export function usePhoto(id?: string): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    setUrl(undefined);
    if (!id) return;
    let off = false;
    db.getPhoto(id).then((p) => { if (!off) setUrl(p?.dataUrl); }).catch(() => {});
    return () => { off = true; };
  }, [id]);
  return url;
}
