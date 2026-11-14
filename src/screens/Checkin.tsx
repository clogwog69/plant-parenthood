import { Check, ChevronLeft, Droplet, ScanSearch, Scissors, Shovel, Smile, Sparkles, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { back, go } from '../App';
import { aiMessage, runAI, type Diagnosis } from '../lib/ai';
import { ago, dayDiff, plantName, seasonFor } from '../lib/care';
import { SIGNS, SIGN_LABEL } from '../lib/checkin';
import { CATEGORY_LABEL, guideFor } from '../lib/guide';
import type { Shot } from '../lib/photo';
import type { Advice, Checkin, Sign } from '../lib/types';
import { useStore } from '../store';
import { PhotoPicker } from '../ui/bits';

const GROUPS = ['Soil', 'Leaves', 'Growth', 'Pot'] as const;
const HEALTH = { good: 'Looking good', watch: 'Keep an eye on it', poor: 'Needs help' };

function AdviceIcon({ kind }: { kind: Advice['kind'] }) {
  if (kind === 'water') return <Droplet size={18} />;
  if (kind === 'hold') return <Timer size={18} />;
  if (kind === 'repot') return <Shovel size={18} />;
  if (kind === 'harvest' || kind === 'prune') return <Scissors size={18} />;
  if (kind === 'good') return <Smile size={18} />;
  return <Sparkles size={18} />;
}

export function CheckinScreen({ id }: { id: string }) {
  const { plants, location, house, checkIn, diagnose } = useStore();
  const plant = plants.find((p) => p.id === id);
  const [shot, setShot] = useState<Shot>();
  const [signs, setSigns] = useState<Sign[]>([]);
  const [note, setNote] = useState('');
  const [made, setResult] = useState<Checkin | null>(null);
  const [looking, setLooking] = useState<'working' | 'done' | string | null>(null);

  useEffect(() => { if (!plant) go('/plants'); }, [plant]);
  if (!plant) return null;

  // Read the saved check-in back from the plant, so the photo diagnosis shows up when it lands.
  const result = made ? plant.checkins.find((c) => c.id === made.id) ?? made : null;
  const last = plant.checkins.find((c) => c.thumb && c.id !== result?.id);

  const submit = () => {
    const c = checkIn(plant.id, signs, note, shot);
    setResult(c);
    window.scrollTo(0, 0);
    if (!c || !shot || !house) return;
    const g = guideFor(plant.guideKey, plant.species);
    setLooking('working');
    runAI<Diagnosis>('diagnose', {
      plant: plant.species, latin: g.latin, type: CATEGORY_LABEL[g.category],
      lives: `${plant.place === 'garden' ? 'outdoors' : 'indoors'}, ${plant.potted ? 'in a pot' : 'in the ground'}`,
      season: seasonFor(location), town: location?.name,
      daysSinceWatered: plant.lastWatered ? dayDiff(Date.now(), plant.lastWatered) : undefined,
      monthsInThisPot: plant.potted ? Math.round(dayDiff(Date.now(), plant.lastRepotted ?? plant.createdAt) / 30) : undefined,
      weeksSinceFed: plant.lastFed ? Math.round(dayDiff(Date.now(), plant.lastFed) / 7) : undefined,
      noticed: signs.map((s) => SIGN_LABEL[s]),
      note: note.trim().slice(0, 300) || undefined,
    }, shot.full)
      .then((dx) => { diagnose(plant.id, c.id, dx); setLooking('done'); })
      .catch((e) => setLooking(aiMessage(e)));
  };
  const lastThumb = last?.thumb ?? (result ? undefined : plant.thumb);
  const toggle = (s: Sign) => setSigns((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  if (result) {
    const jobs = result.advice.filter((a) => !['good', 'hold'].includes(a.kind)).length;
    return (
      <main className="screen form">
        <header className="bar"><h1>Here is what to do</h1></header>
        <p className="hint">For {plantName(plant)}, based on what you saw today{result.summary ? ' and the photo' : ''}.</p>
        {looking === 'working' && (
          <div className="looking"><ScanSearch size={20} /><div><b>Looking at your photo…</b><p>This takes up to a minute. You can tap Done and the result will be saved in the journal.</p></div></div>
        )}
        {looking && looking !== 'working' && looking !== 'done' && (
          <div className="looking failed"><ScanSearch size={20} /><div><b>The photo was not checked</b><p>{looking}</p></div></div>
        )}
        {result.summary && (
          <div className="looking done"><ScanSearch size={20} /><div><b>{HEALTH[result.health ?? 'good']}</b><p>{result.summary}</p></div></div>
        )}
        <ul className="advice">
          {result.advice.map((a, i) => (
            <li key={i} className={`kind-${a.kind}`}>
              <span className="advice-ico"><AdviceIcon kind={a.kind} /></span>
              <div><b>{a.title}</b><p>{a.detail}</p></div>
            </li>
          ))}
        </ul>
        {jobs > 0 && <p className="hint">{jobs === 1 ? 'That job is' : 'Those jobs are'} now on your Today list, so you can tick {jobs === 1 ? 'it' : 'them'} off when done.</p>}
        <div className="sticky-cta">
          <button type="button" className="btn btn-primary wide" onClick={() => back(`/plant/${plant.id}`)}><Check size={18} /> Done</button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen form">
      <header className="bar">
        <button type="button" className="icon-btn" onClick={() => back(`/plant/${plant.id}`)} aria-label="Back"><ChevronLeft size={22} /></button>
        <h1>Check-in</h1>
      </header>
      <p className="hint">A weekly look at {plantName(plant)}. Take a photo, then tap anything you notice.{house ? ' The photo is checked for problems too.' : ''}</p>

      <div className={'compare' + (lastThumb ? ' two' : '')}>
        {lastThumb && (
          <figure>
            <img src={lastThumb} alt="Previous photo" />
            <figcaption>{last ? ago(last.date) : 'Last photo'}</figcaption>
          </figure>
        )}
        <figure>
          <PhotoPicker shot={shot} onShot={setShot} label="Today's photo" className="square" />
          {lastThumb && <figcaption>Today</figcaption>}
        </figure>
      </div>

      {GROUPS.map((group) => {
        const options = SIGNS.filter((s) => s.group === group && (!s.pottedOnly || plant.potted));
        if (!options.length) return null;
        return (
          <section className="group" key={group}>
            <h2>{group}</h2>
            <div className="chips">
              {options.map((o) => (
                <button key={o.sign} type="button" className={'chip-btn' + (signs.includes(o.sign) ? ' on' : '')} aria-pressed={signs.includes(o.sign)} onClick={() => toggle(o.sign)}>
                  {o.label}
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <section className="group">
        <h2>Notes <span className="optional">optional</span></h2>
        <label className="field"><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else worth remembering" /></label>
      </section>

      <div className="sticky-cta">
        <button type="button" className="btn btn-primary wide" onClick={submit}>
          {signs.length ? 'See what to do' : 'All looks healthy'}
        </button>
      </div>
    </main>
  );
}
