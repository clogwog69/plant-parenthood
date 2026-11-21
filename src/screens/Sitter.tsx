import { Check, CloudRain, Droplet, Home, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DAY, plantName, startOfDay, waterPlan } from '../lib/care';
import { guideFor } from '../lib/guide';
import { sitPull, sitWater, type SitView } from '../lib/sync';
import type { Plant, Weather } from '../lib/types';
import { getWeather } from '../lib/weather';
import { Avatar } from '../ui/bits';

const day = (s: string) => new Date(s + 'T00:00').getTime();
const long = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const where = (p: Plant) => p.place === 'indoor' ? 'Inside' : `Outside, ${p.potted ? 'in a pot' : 'in the ground'}${p.covered ? ', under cover' : ''}`;

interface Row { plant: Plant; skipped?: boolean; reason: string }

/** Which plants need water on which day, from the plan each plant has now. */
function schedule(plants: Plant[], weather: Weather | null, loc: SitView['location'], from: number, to: number, now: number) {
  const days = new Map<number, Row[]>();
  for (let t = from; t <= to; t += DAY) days.set(startOfDay(t), []);
  const today = startOfDay(now);
  for (const plant of plants) {
    const w = waterPlan(plant, weather, loc, now);
    let next = today + Math.max(0, w.dueIn) * DAY;
    // Before the sit starts, line it up with the first day they are there.
    while (next < from) next += w.every * DAY;
    for (let t = next, first = true; t <= to; t += w.every * DAY, first = false) {
      days.get(startOfDay(t))?.push({ plant, skipped: first && w.skipped && startOfDay(t) === today, reason: first ? w.reason : guideFor(plant.guideKey, plant.species).water });
    }
  }
  return [...days.entries()];
}

export function Sitter({ token }: { token: string }) {
  const [view, setView] = useState<SitView | null | undefined>(undefined);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    let off = false;
    sitPull(token).then((v) => {
      if (off) return;
      setView(v);
      if (v?.location) getWeather(v.location).then((w) => { if (!off) setWeather(w); }).catch(() => {});
    }).catch(() => { if (!off) { setView(null); setNote('Could not load the plants. Check your connection and try again.'); } });
    return () => { off = true; };
  }, [token]);

  const now = Date.now();
  const days = useMemo(() => {
    if (!view) return [];
    const from = Math.max(startOfDay(now), day(view.starts));
    return schedule(view.plants, weather, view.location, from, day(view.ends), now);
  }, [view, weather, now]);

  if (view === undefined) return <main className="screen sit"><p className="muted">Loading the plants…</p></main>;
  if (!view) {
    return (
      <main className="screen sit">
        <img className="empty-logo" src="./logo.png" alt="" width="110" height="110" />
        <h1>This link has ended</h1>
        <p className="muted">{note || 'The plant sitting is over, or the household took the link back. Ask them for a new one if you are still minding the plants.'}</p>
      </main>
    );
  }

  const water = async (p: Plant) => {
    setBusy(p.id); setNote('');
    try {
      const next = await sitWater(token, p.id);
      if (next) setView((v) => v && { ...v, plants: v.plants.map((x) => (x.id === p.id ? next : x)) });
      else setNote('Could not save that. The link may have ended.');
    } catch { setNote('Could not save that. Check your connection and try again.'); }
    setBusy(null);
  };

  const today = startOfDay(now);
  const notYet = day(view.starts) > today;
  const ended = day(view.ends) < today;
  const doneToday = (p: Plant) => (p.lastWatered ?? 0) >= today;

  return (
    <main className="screen sit">
      <header>
        <p className="eyebrow">Plant sitting for {view.house}</p>
        <h1>Hi {view.name}</h1>
        <p className="muted">
          {notYet ? `Your sit starts ${long(day(view.starts))}. ` : ''}
          You are minding {view.plants.length} plant{view.plants.length === 1 ? '' : 's'} until {long(day(view.ends))}. Here is who needs water and when. Tick them off as you go, and the household will see it.
        </p>
      </header>

      {note && <p className="hint">{note}</p>}
      {ended && <p className="all-done">The sit is over. Thanks for looking after them.</p>}

      {days.map(([t, rows]) => (
        <section key={t}>
          <h2 className="section-title">{t === today ? 'Today' : t === today + DAY ? 'Tomorrow' : long(t)}</h2>
          {rows.length === 0 ? (
            <p className="muted small">No watering. Have a day off.</p>
          ) : (
            <ul className="tasks">
              {rows.map(({ plant, skipped, reason }) => {
                const done = t === today && doneToday(plant);
                return (
                  <li key={plant.id} className={`task tone-water${skipped ? ' skipped' : ''}`}>
                    <Avatar plant={plant} />
                    <div className="task-body">
                      <span className="task-title">
                        <span className="task-ico">{skipped ? <CloudRain size={15} /> : <Droplet size={15} />}</span>
                        {plantName(plant)}
                      </span>
                      <span className="task-plant">{plant.place === 'indoor' ? <Home size={12} /> : <Sun size={12} />} {where(plant)}</span>
                      <span className="task-why open">{done ? 'Watered today. Thank you.' : skipped ? 'Rain is on the way, so leave it today.' : reason}</span>
                    </div>
                    {t === today && !skipped && (
                      <button type="button" className={'check' + (done ? ' on' : '')} disabled={done || busy === plant.id} onClick={() => water(plant)} aria-label={`Watered ${plantName(plant)}`}>
                        <Check size={20} strokeWidth={2.5} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      <p className="muted small">Not sure? Push a finger into the soil. If the top few centimetres are dry, water it. If it is still damp, leave it a day.</p>
    </main>
  );
}
