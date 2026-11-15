import { Check, ChevronLeft, ScanSearch } from 'lucide-react';
import { useState } from 'react';
import { back, go } from '../App';
import { aiAvailable, aiMessage, runAI, type Diagnosis } from '../lib/ai';
import { dayDiff, plantName, seasonFor } from '../lib/care';
import { CATEGORY_LABEL, guideFor } from '../lib/guide';
import type { Shot } from '../lib/photo';
import type { AdviceKind } from '../lib/types';
import { useStore } from '../store';
import { Avatar, PhotoPicker } from '../ui/bits';
import { AdviceIcon, HEALTH } from './Checkin';

const KIND: Record<string, AdviceKind> = { water: 'water', hold: 'hold', repot: 'repot', feed: 'care', prune: 'prune', harvest: 'harvest', care: 'care', good: 'good' };

/** Snap a photo of any plant and get told what is wrong with it. */
export function Doctor() {
  const { plants, location, checkIn, diagnose } = useStore();
  const [shot, setShot] = useState<Shot>();
  const [plantId, setPlantId] = useState<string>('');
  const [state, setState] = useState<'idle' | 'working' | { dx: Diagnosis } | { error: string }>('idle');
  const [saved, setSaved] = useState(false);
  const plant = plants.find((p) => p.id === plantId);
  const ready = aiAvailable();

  const check = () => {
    if (!shot) return;
    setState('working');
    setSaved(false);
    window.scrollTo(0, 0);
    const where = { season: seasonFor(location), town: location?.name };
    const g = plant && guideFor(plant.guideKey, plant.species);
    const input = plant && g
      ? {
        ...where,
        plant: plant.species, latin: g.latin, type: CATEGORY_LABEL[g.category],
        lives: `${plant.place === 'garden' ? 'outdoors' : 'indoors'}, ${plant.potted ? 'in a pot' : 'in the ground'}`,
        daysSinceWatered: plant.lastWatered ? dayDiff(Date.now(), plant.lastWatered) : undefined,
        weeksSinceFed: plant.lastFed ? Math.round(dayDiff(Date.now(), plant.lastFed) / 7) : undefined,
      }
      : { ...where, plant: 'Not given. Start the summary by saying what plant this looks like.' };
    runAI<Diagnosis>('diagnose', input, shot.full)
      .then((dx) => setState({ dx }))
      .catch((e) => setState({ error: aiMessage(e) }));
  };

  const save = (dx: Diagnosis) => {
    if (!plant || !shot) return;
    const c = checkIn(plant.id, [], '', shot);
    if (c) diagnose(plant.id, c.id, dx);
    setSaved(true);
  };

  const dx = typeof state === 'object' && 'dx' in state ? state.dx : null;
  const findings = dx && Array.isArray(dx.findings) ? dx.findings.filter((f) => f?.title && f?.detail).slice(0, 5) : [];

  return (
    <main className="screen form">
      <header className="bar">
        <button type="button" className="icon-btn" onClick={() => back('/')} aria-label="Back"><ChevronLeft size={22} /></button>
        <h1>Plant doctor</h1>
      </header>
      <p className="hint">Take a photo of a sick-looking plant, close enough to see the leaves. You get told what is wrong and what to do.</p>

      {!ready && (
        <div className="looking failed"><ScanSearch size={20} /><div><b>Not set up yet</b><p>Photo help works once you have set up a household. Go to the Plants tab and tap the household bar.</p></div></div>
      )}

      {state === 'working' && (
        <div className="looking"><ScanSearch size={20} /><div><b>Looking at your photo…</b><p>This takes up to a minute.</p></div></div>
      )}
      {typeof state === 'object' && 'error' in state && (
        <div className="looking failed"><ScanSearch size={20} /><div><b>The photo was not checked</b><p>{state.error}</p></div></div>
      )}
      {dx && (
        <>
          <div className="looking done"><ScanSearch size={20} /><div><b>{HEALTH[dx.health === 'poor' || dx.health === 'watch' ? dx.health : 'good']}</b><p>{dx.summary}</p></div></div>
          <ul className="advice">
            {findings.map((f, i) => (
              <li key={i} className={`kind-${KIND[f.action] ?? 'care'}`}>
                <span className="advice-ico"><AdviceIcon kind={KIND[f.action] ?? 'care'} /></span>
                <div><b>{f.title}</b><p>{f.detail}</p></div>
              </li>
            ))}
          </ul>
          {plant && (saved
            ? <p className="hint"><Check size={14} /> Saved to {plantName(plant)}'s journal, and any jobs are on your Today list.</p>
            : <button type="button" className="btn btn-soft wide" onClick={() => save(dx)}>Save to {plantName(plant)}'s journal</button>)}
        </>
      )}

      <PhotoPicker shot={shot} onShot={(s) => { setShot(s); setState('idle'); setSaved(false); }} label="Take a photo" className="square" />

      {plants.length > 0 && (
        <section className="group">
          <h2>Which plant is it? <span className="optional">optional</span></h2>
          <div className="who-list">
            <button type="button" className={'who' + (!plantId ? ' on' : '')} onClick={() => setPlantId('')}>
              <span className="who-none"><ScanSearch size={18} /></span>
              <small>Not sure</small>
            </button>
            {plants.map((p) => (
              <button key={p.id} type="button" className={'who' + (plantId === p.id ? ' on' : '')} onClick={() => setPlantId(p.id)}>
                <Avatar plant={p} />
                <small>{plantName(p)}</small>
              </button>
            ))}
          </div>
          <p className="muted small">Picking one gives a better answer, because it knows when you last watered and fed it.</p>
        </section>
      )}

      <div className="sticky-cta">
        {dx || (typeof state === 'object' && 'error' in state)
          ? <button type="button" className="btn btn-primary wide" onClick={() => (saved && plant ? go(`/plant/${plant.id}`) : check())} disabled={!shot || !ready}>{saved ? 'Open the plant' : 'Check again'}</button>
          : <button type="button" className="btn btn-primary wide" onClick={check} disabled={!shot || !ready || state === 'working'}><ScanSearch size={18} /> {state === 'working' ? 'Looking…' : 'Check my plant'}</button>}
      </div>
    </main>
  );
}
