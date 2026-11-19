import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Diagnosis } from './lib/ai';
import { digest, plantName } from './lib/care';
import { adviceFor, applyAdvice } from './lib/checkin';
import * as db from './lib/db';
import type { Shot } from './lib/photo';
import { notifyHouse, type PushKind } from './lib/push';
import * as remote from './lib/sync';
import type { House } from './lib/sync';
import type { Advice, AdviceKind, Checkin, EventType, Location, Photo, Place, Plant, Sign, TagInfo, Weather, Stage } from './lib/types';
import { getWeather } from './lib/weather';

export type View = 'grid' | 'list';
export type SyncState = 'off' | 'idle' | 'syncing' | 'offline';

export interface NewPlant {
  guideKey: string;
  species: string;
  nickname?: string;
  place: Place;
  potted: boolean;
  lastWatered?: number;
  shot?: Shot;
  tag?: TagInfo;
  stage?: Stage | null;
}

interface Store {
  ready: boolean;
  plants: Plant[];
  location: Location | null;
  weather: Weather | null;
  weatherFailed: boolean;
  view: View;
  /** The shared household this phone belongs to, if any. */
  house: House | null;
  /** This person's name, shown to the rest of the household. */
  me: string;
  syncState: SyncState;
  setView(v: View): void;
  setLocation(l: Location | null): void;
  addPlant(p: NewPlant): Plant;
  removePlant(id: string): void;
  log(id: string, type: Exclude<EventType, 'added'>): void;
  completeTodo(id: string, todoId: string): void;
  checkIn(id: string, signs: Sign[], note: string, shot?: Shot): Checkin | null;
  /** A quick progress photo, no questions asked. */
  addPhoto(id: string, shot: Shot): void;
  setTag(id: string, tag: TagInfo | undefined): void;
  /** Change what it is, where it lives or its nickname. */
  editPlant(id: string, changes: Partial<Pick<Plant, 'guideKey' | 'species' | 'nickname' | 'place' | 'potted' | 'age'>>): void;
  /** Save how much sun it gets through the day. Empty clears it. */
  setSun(id: string, sun: Plant['sun']): void;
  /** Fold what the photo diagnosis found into a check-in. */
  diagnose(id: string, checkinId: string, dx: Diagnosis): void;
  createHouse(name: string, me: string): Promise<void>;
  /** Rejects with a readable message when the code is wrong. */
  joinHouse(code: string, me: string): Promise<void>;
  leaveHouse(): void;
  syncNow(): void;
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

type Dirty = Record<string, 'put' | 'del'>;
const K = { house: 'sprout.house', me: 'sprout.me', since: 'sprout.since', dirty: 'sprout.dirty', photos: 'sprout.dirtyPhotos', loc: 'sprout.locDirty', digest: 'sprout.digest' };

const STAMP: Record<Exclude<EventType, 'added'>, 'lastWatered' | 'lastRepotted' | 'lastHarvested' | 'lastFed'> = {
  fed: 'lastFed',
  watered: 'lastWatered',
  repotted: 'lastRepotted',
  harvested: 'lastHarvested',
};

const DID: Record<Exclude<EventType, 'added'>, string> = { watered: 'watered', repotted: 'repotted', harvested: 'picked from', fed: 'fed' };
const DX_KIND: Record<string, AdviceKind> = { water: 'water', hold: 'hold', repot: 'repot', feed: 'care', prune: 'prune', harvest: 'harvest', care: 'care', good: 'good' };
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const byAge = (a: Plant, b: Plant) => a.createdAt - b.createdAt;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [ready, setReady] = useState(false);
  const [location, setLoc] = useState<Location | null>(() => read('sprout.location', null));
  const [view, setV] = useState<View>(() => read('sprout.view', 'grid'));
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherFailed, setFailed] = useState(false);
  const [house, setHouse] = useState<House | null>(() => (remote.syncAvailable ? read(K.house, null) : null));
  const [me, setMe] = useState<string>(() => read(K.me, ''));
  const [syncState, setSyncState] = useState<SyncState>(house ? 'idle' : 'off');
  const ref = useRef<Plant[]>([]);
  const houseRef = useRef(house);
  const meRef = useRef(me);
  const locRef = useRef(location);
  const weatherRef = useRef<Weather | null>(null);
  const busy = useRef(false);
  const again = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const commit = useCallback((next: Plant[]) => {
    ref.current = next;
    setPlants(next);
  }, []);

  const applyLocation = useCallback((l: Location | null) => {
    locRef.current = l;
    setLoc(l);
    write('sprout.location', l);
  }, []);

  /** One round trip: take the household's changes, then send ours. */
  const sync = useCallback(async () => {
    const h = houseRef.current;
    if (!h) return;
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    setSyncState('syncing');
    try {
      const got = await remote.pull(h.code, read<string | null>(K.since, null));
      if (houseRef.current?.code !== h.code) return;
      if (!got) throw new Error('household not found');

      const dirty = read<Dirty>(K.dirty, {});
      let next = ref.current;
      for (const r of got.plants) {
        if (dirty[r.id] === 'del') continue;
        const local = next.find((p) => p.id === r.id);
        if (r.deleted || !r.data) {
          if (local) {
            next = next.filter((p) => p.id !== r.id);
            void db.deletePlant(r.id);
            void db.deletePhotosFor(r.id);
          }
          delete dirty[r.id];
        } else if (!local || (r.data.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
          const data = r.data;
          next = local ? next.map((p) => (p.id === r.id ? data : p)) : [...next, data];
          void db.putPlant(data);
          delete dirty[r.id];
        }
      }
      if (next !== ref.current) commit([...next].sort(byAge));
      write(K.dirty, dirty);

      if (read(K.loc, false) || (!got.location && locRef.current)) {
        await remote.setLocation(h.code, locRef.current);
        write(K.loc, false);
      } else if (got.location && JSON.stringify(got.location) !== JSON.stringify(locRef.current)) {
        applyLocation(got.location);
      }

      for (const id of read<string[]>(K.photos, [])) {
        const photo = await db.getPhoto(id);
        if (photo) await remote.putPhoto(h.code, photo);
        write(K.photos, read<string[]>(K.photos, []).filter((x) => x !== id));
      }

      const ids = Object.keys(read<Dirty>(K.dirty, {}));
      for (let i = 0; i < ids.length; i += 5) {
        const todo = read<Dirty>(K.dirty, {});
        const rows = ids.slice(i, i + 5).flatMap((id): remote.PushRow[] => {
          if (todo[id] === 'del') return [{ id, data: null, deleted: true }];
          const p = ref.current.find((x) => x.id === id);
          return p ? [{ id, data: p, deleted: false }] : [];
        });
        if (rows.length) await remote.push(h.code, rows);
        const after = read<Dirty>(K.dirty, {});
        for (const row of rows) {
          const now = ref.current.find((x) => x.id === row.id);
          // Leave it queued if it changed again while we were sending.
          if (row.deleted || !now || now.updatedAt === row.data?.updatedAt) delete after[row.id];
        }
        write(K.dirty, after);
      }

      // The week ahead, in words, for the morning notification.
      const week = JSON.stringify(digest(ref.current, weatherRef.current, locRef.current));
      if (week !== read<string>(K.digest, '')) {
        remote.setDigest(h.code, JSON.parse(week)).then((ok) => { if (ok) write(K.digest, week); }).catch(() => {});
      }

      write(K.since, got.now);
      setSyncState('idle');
    } catch {
      if (houseRef.current) setSyncState('offline');
    } finally {
      busy.current = false;
      if (again.current) { again.current = false; void sync(); }
    }
  }, [commit, applyLocation]);

  const soon = useCallback(() => {
    if (!houseRef.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void sync(), 500);
  }, [sync]);

  const markDirty = useCallback((id: string, kind: 'put' | 'del') => {
    if (!houseRef.current) return;
    write(K.dirty, { ...read<Dirty>(K.dirty, {}), [id]: kind });
    soon();
  }, [soon]);

  const savePhoto = useCallback((p: Photo) => {
    void db.putPhoto(p);
    if (houseRef.current) write(K.photos, [...read<string[]>(K.photos, []), p.id]);
  }, []);

  useEffect(() => {
    db.allPlants()
      .then((p) => commit(p.sort(byAge)))
      .catch(() => {})
      .finally(() => { setReady(true); void sync(); });
  }, [commit, sync]);

  // Keep everyone in the house up to date while the app is open.
  useEffect(() => {
    if (!house) return;
    const tick = () => { if (document.visibilityState === 'visible') void sync(); };
    const every = window.setInterval(tick, 20000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);
    return () => { window.clearInterval(every); document.removeEventListener('visibilitychange', tick); window.removeEventListener('online', tick); };
  }, [house, sync]);

  useEffect(() => { weatherRef.current = weather; }, [weather]);

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
    const next = { ...fn(old), updatedAt: Date.now() };
    commit(ref.current.map((p) => (p.id === id ? next : p)));
    void db.putPlant(next);
    markDirty(id, 'put');
    return next;
  }, [commit, markDirty]);

  /** Enter a household: everything already on this phone is shared into it. */
  const enter = useCallback(async (h: House, name: string) => {
    const photos = await db.photoIds().catch(() => [] as string[]);
    const dirty: Dirty = {};
    for (const p of ref.current) dirty[p.id] = 'put';
    write(K.dirty, dirty);
    write(K.photos, photos);
    write(K.since, null);
    write(K.loc, false);
    write(K.digest, '');
    write(K.house, h);
    write(K.me, name);
    houseRef.current = h;
    meRef.current = name;
    setHouse(h);
    setMe(name);
    setSyncState('idle');
    void sync();
  }, [sync]);

  const store = useMemo<Store>(() => {
    const who = () => (houseRef.current && meRef.current ? meRef.current : undefined);
    /** Let the rest of the household know, if they have notifications on. */
    const tell = (kind: PushKind, did: string, p: Plant | undefined | null) => {
      const h = houseRef.current;
      // Household name on top, then what happened: "Prescott Drive" / "Simone watered Basil".
      if (h && meRef.current && p) notifyHouse(h.code, kind, h.name, `${meRef.current} ${did} ${plantName(p)}`);
    };
    return {
      ready, plants, location, weather, weatherFailed, view, house, me, syncState,
      setView(v) { setV(v); write('sprout.view', v); },
      setLocation(l) {
        applyLocation(l);
        if (houseRef.current) { write(K.loc, true); soon(); }
      },

      addPlant(n) {
        const now = Date.now();
        const id = uid();
        const photoId = n.shot ? uid() : undefined;
        const plant: Plant = {
          id, guideKey: n.guideKey, species: n.species, nickname: n.nickname || undefined,
          place: n.place, potted: n.potted, createdAt: now, updatedAt: now,
          thumb: n.shot?.thumb, photoId, lastWatered: n.lastWatered, tag: n.tag,
          age: n.stage ? { stage: n.stage, at: now } : undefined,
          firstPhoto: n.shot && photoId ? { photoId, thumb: n.shot.thumb, date: now } : undefined,
          todos: [], checkins: [], events: [{ type: 'added', date: now, by: who() }],
        };
        if (n.shot && photoId) savePhoto({ id: photoId, plantId: id, date: now, dataUrl: n.shot.full });
        commit([...ref.current, plant]);
        void db.putPlant(plant);
        markDirty(id, 'put');
        tell('plant', 'added', plant);
        return plant;
      },

      removePlant(id) {
        commit(ref.current.filter((p) => p.id !== id));
        void db.deletePlant(id);
        void db.deletePhotosFor(id);
        markDirty(id, 'del');
      },

      log(id, type) {
        const now = Date.now();
        tell('care', DID[type], patch(id, (p) => ({
          ...p,
          [STAMP[type]]: now,
          holdWaterUntil: type === 'watered' ? undefined : p.holdWaterUntil,
          todos: p.todos.filter((t) => !(type === 'watered' && t.kind === 'water') && !(type === 'repotted' && t.kind === 'repot') && !(type === 'harvested' && t.kind === 'harvest')),
          events: [{ type, date: now, by: who() }, ...p.events],
        })));
      },

      completeTodo(id, todoId) {
        const now = Date.now();
        patch(id, (p) => {
          const todo = p.todos.find((t) => t.id === todoId);
          const next: Plant = { ...p, todos: p.todos.filter((t) => t.id !== todoId) };
          if (todo?.kind === 'water') { next.lastWatered = now; next.holdWaterUntil = undefined; next.events = [{ type: 'watered', date: now, by: who() }, ...p.events]; }
          if (todo?.kind === 'repot') { next.lastRepotted = now; next.events = [{ type: 'repotted', date: now, by: who() }, ...p.events]; }
          if (todo?.kind === 'harvest') { next.lastHarvested = now; next.events = [{ type: 'harvested', date: now, by: who() }, ...p.events]; }
          return next;
        });
      },

      checkIn(id, signs, note, shot) {
        const now = Date.now();
        let made: Checkin | null = null;
        tell('checkin', 'checked on', patch(id, (p) => {
          const advice = adviceFor(p, signs, now);
          const photoId = shot ? uid() : undefined;
          if (shot && photoId) savePhoto({ id: photoId, plantId: id, date: now, dataUrl: shot.full });
          made = { id: uid(), date: now, photoId, thumb: shot?.thumb, signs, advice, note: note.trim() || undefined, by: who() };
          const withAdvice = applyAdvice(p, advice, uid, now);
          return {
            ...withAdvice,
            checkins: [made, ...p.checkins],
            thumb: shot?.thumb ?? p.thumb,
            photoId: photoId ?? p.photoId,
          };
        }));
        return made;
      },

      addPhoto(id, shot) {
        const now = Date.now();
        const photoId = uid();
        savePhoto({ id: photoId, plantId: id, date: now, dataUrl: shot.full });
        tell('checkin', 'added a photo of', patch(id, (p) => ({
          ...p,
          checkins: [{ id: uid(), date: now, kind: 'photo', photoId, thumb: shot.thumb, signs: [], advice: [], by: who() }, ...p.checkins],
          thumb: shot.thumb,
          photoId,
        })));
      },

      setTag(id, tag) {
        patch(id, (p) => ({ ...p, tag }));
      },

      editPlant(id, changes) {
        patch(id, (p) => ({ ...p, ...changes, nickname: (changes.nickname ?? p.nickname)?.trim() || undefined }));
      },

      setSun(id, sun) {
        patch(id, (p) => ({ ...p, sun: sun && Object.keys(sun).length ? sun : undefined }));
      },

      diagnose(id, checkinId, dx) {
        const found: Advice[] = (Array.isArray(dx.findings) ? dx.findings : []).slice(0, 5).flatMap((f): Advice[] => {
          const title = text(f?.title, 60);
          const detail = text(f?.detail, 500);
          return title && detail ? [{ sign: 'ai', kind: DX_KIND[f.action] ?? 'care', title, detail }] : [];
        });
        const health = dx.health === 'poor' || dx.health === 'watch' ? dx.health : 'good';
        patch(id, (p) => ({
          ...applyAdvice(p, found, uid),
          checkins: p.checkins.map((c) => (c.id !== checkinId ? c : {
            ...c,
            summary: text(dx.summary, 300) || undefined,
            health,
            advice: [...c.advice.filter((a) => !(a.sign === 'looks_great' && found.length)), ...found],
          })),
        }));
      },

      async createHouse(name, myName) {
        let h: House;
        try { h = await remote.createHouse(name.trim() || 'Home'); } catch { throw new Error('Could not reach Plant Parenthood. Check your connection and try again.'); }
        await enter(h, myName.trim());
      },

      async joinHouse(code, myName) {
        let h: House | null;
        try { h = await remote.joinHouse(code); } catch { throw new Error('Could not reach Plant Parenthood. Check your connection and try again.'); }
        if (!h) throw new Error('No household has that code. Check it and try again.');
        await enter(h, myName.trim());
      },

      leaveHouse() {
        houseRef.current = null;
        for (const k of [K.house, K.since, K.dirty, K.photos, K.loc, K.digest]) { try { localStorage.removeItem(k); } catch { /* private mode */ } }
        setHouse(null);
        setSyncState('off');
      },

      syncNow() { void sync(); },
    };
  }, [ready, plants, location, weather, weatherFailed, view, house, me, syncState, commit, patch, markDirty, savePhoto, applyLocation, soon, enter, sync]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

/** Loads a full-size photo from the phone, or from the household if another phone took it. */
export function usePhoto(id?: string): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    setUrl(undefined);
    if (!id) return;
    let off = false;
    (async () => {
      const local = await db.getPhoto(id).catch(() => undefined);
      if (local) { if (!off) setUrl(local.dataUrl); return; }
      const h = read<House | null>(K.house, null);
      if (!h || !remote.syncAvailable) return;
      const far = await remote.getPhoto(h.code, id).catch(() => null);
      if (!far) return;
      void db.putPhoto({ id, ...far });
      if (!off) setUrl(far.dataUrl);
    })();
    return () => { off = true; };
  }, [id]);
  return url;
}
