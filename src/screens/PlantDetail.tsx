import { Camera, Check, ChevronLeft, ChevronRight, Droplet, MapPin, MessageCircleQuestion, Plus, ScanText, Scissors, Shovel, Sprout, Sun, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { back, go } from '../App';
import { aiMessage, runAI, type Answer, type TagRead } from '../lib/ai';
import { ago, dayDiff, dueLabel, feedPlan, placement, plantName, repotStatus, seasonFor, tasksFor, waterPlan } from '../lib/care';
import { SIGN_LABEL } from '../lib/checkin';
import { CATEGORY_LABEL, guideFor } from '../lib/guide';
import type { EventType, Plant, TagInfo } from '../lib/types';
import { useStore, usePhoto } from '../store';
import { Avatar, PhotoButton } from '../ui/bits';
import { TaskIcon, taskTone, useTaskDone } from './Today';

const EVENT: Record<EventType, string> = { watered: 'Watered', repotted: 'Repotted', harvested: 'Harvested', fed: 'Fed', added: 'Added to Plant Parenthood' };
const HEALTH = { good: 'Looking good', watch: 'Keep an eye on it', poor: 'Needs help' };
export const TAG_FIELDS: [keyof TagRead, string][] = [['light', 'Light'], ['water', 'Water'], ['size', 'Grows to'], ['feeding', 'Feeding'], ['notes', 'Also on the tag']];

interface Frame { photoId?: string; thumb: string; date: number }

/** Every photo of the plant, oldest first. */
function framesOf(p: Plant): Frame[] {
  const out: Frame[] = p.checkins.filter((c) => c.thumb).map((c) => ({ photoId: c.photoId, thumb: c.thumb!, date: c.date }));
  if (p.firstPhoto) out.push(p.firstPhoto);
  else if (p.thumb && !out.length) out.push({ photoId: p.photoId, thumb: p.thumb, date: p.createdAt });
  return out.sort((a, b) => a.date - b.date);
}

const dated = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function Viewer({ frames, at, onAt, onClose }: { frames: Frame[]; at: number; onAt(i: number): void; onClose(): void }) {
  const f = frames[at];
  const full = usePhoto(f.photoId);
  const days = dayDiff(f.date, frames[0].date);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && at > 0) onAt(at - 1);
      if (e.key === 'ArrowRight' && at < frames.length - 1) onAt(at + 1);
    };
    window.addEventListener('keydown', on);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', on); document.body.style.overflow = ''; };
  }, [at, frames.length, onAt, onClose]);
  return (
    <div className="viewer" role="dialog" aria-label="Progress photos">
      <header>
        <span><b>{dated(f.date)}</b><small>{at === 0 ? 'First photo' : days === 0 ? 'Same day as the first photo' : `${days} ${days === 1 ? 'day' : 'days'} after the first photo`}</small></span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
      </header>
      <img src={full ?? f.thumb} alt={`Photo from ${dated(f.date)}`} />
      <footer>
        <button type="button" className="icon-btn" disabled={at === 0} onClick={() => onAt(at - 1)} aria-label="Older photo"><ChevronLeft size={22} /></button>
        <span>{at + 1} of {frames.length}</span>
        <button type="button" className="icon-btn" disabled={at === frames.length - 1} onClick={() => onAt(at + 1)} aria-label="Newer photo"><ChevronRight size={22} /></button>
      </footer>
    </div>
  );
}

export function PlantDetail({ id }: { id: string }) {
  const { plants, weather, location, house, log, removePlant, addPhoto, setTag } = useStore();
  const plant = plants.find((p) => p.id === id);
  const photo = usePhoto(plant?.photoId);
  const done = useTaskDone();
  const [viewing, setViewing] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [tagNote, setTagNote] = useState('');
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [reply, setReply] = useState<{ q: string; a: string; failed?: boolean } | null>(null);

  useEffect(() => { if (!plant) go('/plants'); }, [plant]);
  if (!plant) return null;

  const g = guideFor(plant.guideKey, plant.species);
  const water = waterPlan(plant, weather, location);
  const repot = repotStatus(plant, location);
  const feed = feedPlan(plant, location);
  const spot = placement(plant, location);
  const season = seasonFor(location);
  const jobs = tasksFor(plant, weather, location).filter((t) => t.kind !== 'water' && t.dueIn <= 0);
  const inSeason = g.harvest && (!g.harvest.seasons || g.harvest.seasons.includes(season));
  const frames = framesOf(plant);

  const journal = [
    ...plant.checkins.map((c) => ({ date: c.date, checkin: c, event: null as EventType | null, by: c.by })),
    ...plant.events.map((e) => ({ date: e.date, checkin: null, event: e.type as EventType | null, by: e.by })),
  ].sort((a, b) => b.date - a.date).slice(0, 40);

  const wateredBy = plant.events.find((e) => e.type === 'watered' && e.date === plant.lastWatered)?.by;

  const waterHead = water.skipped ? 'Skip watering, rain is coming'
    : water.dueIn < 0 ? `Water now (${dueLabel(water.dueIn).toLowerCase()})`
    : water.dueIn === 0 ? 'Water today'
    : `Water ${dueLabel(water.dueIn).toLowerCase()}`;

  const about = () => ({
    plant: plant.species, latin: g.latin, type: CATEGORY_LABEL[g.category],
    lives: `${plant.place === 'garden' ? 'outdoors' : 'indoors'}, ${plant.potted ? 'in a pot' : 'in the ground'}`,
    season, town: location?.name,
    lastWatered: plant.lastWatered ? ago(plant.lastWatered) : 'unknown',
    inThisPotSince: plant.potted ? dated(plant.lastRepotted ?? plant.createdAt) : undefined,
  });

  const scanTag = async (full: string) => {
    setScanning(true); setTagNote('');
    try {
      const t = await runAI<TagRead>('tag', {}, full);
      const tag: TagInfo = { date: Date.now() };
      if (typeof t.name === 'string' && t.name.trim()) tag.name = t.name.trim().slice(0, 80);
      for (const [k] of TAG_FIELDS) if (typeof t[k] === 'string' && t[k].trim()) tag[k] = t[k].trim().slice(0, 400);
      if (Object.keys(tag).length > 1) setTag(plant.id, tag);
      else setTagNote('Could not read anything on that tag. Try again closer up, in good light.');
    } catch (e) { setTagNote(aiMessage(e)); }
    setScanning(false);
  };

  const ask = async () => {
    const q = question.trim();
    if (!q) return;
    setAsking(true); setReply(null);
    try {
      const r = await runAI<Answer>('ask', { ...about(), question: q.slice(0, 500) }, photo);
      setReply({ q, a: String(r.answer ?? '').slice(0, 2000) });
      setQuestion('');
    } catch (e) { setReply({ q, a: aiMessage(e), failed: true }); }
    setAsking(false);
  };

  return (
    <main className="screen detail">
      <div className={`hero cat-${g.category}`}>
        {photo || plant.thumb ? <img src={photo ?? plant.thumb} alt={plantName(plant)} /> : <span className="avatar-letter">{plant.species.charAt(0).toUpperCase()}</span>}
        <button type="button" className="icon-btn floating" onClick={() => back('/plants')} aria-label="Back"><ChevronLeft size={22} /></button>
      </div>

      <header className="detail-head">
        <h1>{plantName(plant)}</h1>
        <p><i>{plant.nickname ? `${plant.species} · ` : ''}{g.latin}</i></p>
        <p className="tags">
          <span>{plant.place === 'garden' ? 'Garden' : 'Indoors'}</span>
          <span>{plant.potted ? 'In a pot' : 'In the ground'}</span>
          <span>{CATEGORY_LABEL[g.category]}</span>
        </p>
      </header>

      <section className={'next' + (water.dueIn <= 0 && !water.skipped ? ' due' : '')}>
        <div className="next-top">
          <span className="next-ico"><Droplet size={20} /></span>
          <div>
            <b>{waterHead}</b>
            <p>{water.reason}</p>
            {plant.lastWatered && <small>Last watered {ago(plant.lastWatered).toLowerCase()}{wateredBy ? ` by ${wateredBy}` : ''}</small>}
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => log(plant.id, 'watered')}><Droplet size={18} /> Watered</button>
          <a className="btn btn-soft" href={`#/plant/${plant.id}/checkin`}><Camera size={18} /> Check-in</a>
        </div>
      </section>

      {jobs.length > 0 && (
        <section>
          <h2 className="section-title">To do</h2>
          <ul className="jobs">
            {jobs.map((t) => (
              <li key={t.id} className={`tone-${taskTone(t)}`}>
                <span className="task-ico"><TaskIcon task={t} /></span>
                <div><b>{t.title}</b><p>{t.reason}</p></div>
                <button type="button" className="check" onClick={() => done(t)} aria-label={t.kind === 'photo' ? 'Take the photo' : 'Mark as done'}>
                  {t.kind === 'photo' ? <Camera size={18} /> : <Check size={20} strokeWidth={2.5} />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="section-title">Where to put it</h2>
        <div className="spot">
          <span className="spot-ico"><MapPin size={20} /></span>
          <div>
            <b>{spot.title}</b>
            <p>{spot.detail}</p>
            <small>{plant.place === 'garden' ? 'Outdoor plant' : 'Indoor plant'}{location ? ` · advice for ${location.name}` : ''}</small>
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">Progress photos {frames.length > 1 && <span className="count soft">{frames.length}</span>}</h2>
        <ul className="strip">
          <li>
            <PhotoButton className="strip-add" onShot={(s) => addPhoto(plant.id, s)}><Plus size={22} /><span>Add photo</span></PhotoButton>
          </li>
          {frames.map((f, i) => ({ f, i })).reverse().map(({ f, i }) => (
            <li key={`${f.date}${i}`}>
              <button type="button" onClick={() => setViewing(i)} aria-label={`Photo from ${dated(f.date)}`}>
                <img src={f.thumb} alt="" />
                <small>{i === 0 && frames.length > 1 ? 'First' : new Date(f.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</small>
              </button>
            </li>
          ))}
        </ul>
        {frames.length > 1
          ? <button type="button" className="link" onClick={() => setViewing(0)}>See how it has grown since {dated(frames[0].date)}</button>
          : <p className="muted small">Add a photo every week or two and flick through them to watch it grow.</p>}
      </section>

      <section>
        <h2 className="section-title">Care guide</h2>
        <dl className="guide">
          <div><dt><Droplet size={16} /> Water</dt><dd>{g.water}</dd></div>
          <div><dt><Sun size={16} /> Light</dt><dd>{g.light}</dd></div>
          <div>
            <dt><Sprout size={16} /> Feed</dt>
            <dd>
              {feed.what}
              <small>{feed.note}{plant.lastFed ? ` Last fed ${ago(plant.lastFed).toLowerCase()}.` : ''}</small>
              <button type="button" className="link" onClick={() => log(plant.id, 'fed')}>I fed it today</button>
            </dd>
          </div>
          {g.harvest && (
            <div>
              <dt><Scissors size={16} /> Harvest</dt>
              <dd>
                {g.harvest.how}
                {!inSeason && g.harvest.seasons && <small>Usually ready in {g.harvest.seasons.join(' and ')}.</small>}
                {inSeason && <button type="button" className="link" onClick={() => log(plant.id, 'harvested')}>I picked some today</button>}
              </dd>
            </div>
          )}
          {repot && (
            <div>
              <dt><Shovel size={16} /> Repot</dt>
              <dd>
                {repot.note}
                <button type="button" className="link" onClick={() => log(plant.id, 'repotted')}>I repotted it today</button>
              </dd>
            </div>
          )}
        </dl>
        <ul className="tips">{g.tips.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>

      {(plant.tag || house) && (
        <section>
          <h2 className="section-title">From the tag</h2>
          {plant.tag ? (
            <dl className="guide">
              {plant.tag.name && <div><dt>Name on the tag</dt><dd>{plant.tag.name}</dd></div>}
              {TAG_FIELDS.map(([k, label]) => plant.tag?.[k] && <div key={k}><dt>{label}</dt><dd>{plant.tag[k]}</dd></div>)}
            </dl>
          ) : (
            <p className="muted small">Kept the little tag the plant came with? Take a photo and its details are copied here.</p>
          )}
          {house && (
            <PhotoButton className="btn btn-soft wide gap-top" disabled={scanning} onShot={(s) => void scanTag(s.full)}>
              <ScanText size={18} /> {scanning ? 'Reading the tag…' : plant.tag ? 'Scan the tag again' : 'Scan the plant tag'}
            </PhotoButton>
          )}
          {tagNote && <p className="warn">{tagNote}</p>}
          {plant.tag && <button type="button" className="link" onClick={() => { if (window.confirm('Remove the tag details?')) setTag(plant.id, undefined); }}>Remove tag details</button>}
        </section>
      )}

      {house && (
        <section>
          <h2 className="section-title">Ask about this plant</h2>
          <label className="field"><textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Why are the bottom leaves going yellow?" maxLength={500} /></label>
          <button type="button" className="btn btn-soft wide gap-top" disabled={asking || !question.trim()} onClick={() => void ask()}>
            <MessageCircleQuestion size={18} /> {asking ? 'Thinking…' : 'Ask'}
          </button>
          {asking && <p className="muted small">This takes up to a minute. {photo ? 'The latest photo is sent along with your question.' : ''}</p>}
          {reply && (
            <div className={'reply' + (reply.failed ? ' failed' : '')}>
              <small>{reply.q}</small>
              {reply.a.split(/\n+/).map((line, i) => <p key={i}>{line}</p>)}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="section-title">Journal</h2>
        <ol className="journal">
          {journal.map((j, i) => j.checkin ? (
            <li key={j.checkin.id} className="entry">
              {j.checkin.thumb ? <img src={j.checkin.thumb} alt="" /> : <Avatar plant={{ ...plant, thumb: undefined }} />}
              <div>
                <b>{j.checkin.kind === 'photo' ? 'Progress photo' : 'Check-in'} <small>{ago(j.date)}{j.by ? ` · ${j.by}` : ''}</small></b>
                {j.checkin.summary && <p><span className={`health health-${j.checkin.health ?? 'good'}`}>{HEALTH[j.checkin.health ?? 'good']}</span> {j.checkin.summary}</p>}
                {j.checkin.signs.length > 0 && <p className="signs">{j.checkin.signs.map((s) => SIGN_LABEL[s]).join(' · ')}</p>}
                {j.checkin.advice.map((a, n) => <p key={n}><strong>{a.title}.</strong> {a.detail}</p>)}
                {j.checkin.note && <p className="note">“{j.checkin.note}”</p>}
              </div>
            </li>
          ) : (
            <li key={`${j.event}${j.date}${i}`} className="event"><span>{EVENT[j.event!]}{j.by ? ` by ${j.by}` : ''}</span><small>{ago(j.date)}</small></li>
          ))}
        </ol>
      </section>

      <button
        type="button" className="btn btn-danger"
        onClick={() => { if (window.confirm(`Remove ${plantName(plant)} and all its photos? This cannot be undone.`)) { removePlant(plant.id); go('/plants'); } }}
      >
        <Trash2 size={16} /> Remove this plant
      </button>

      {viewing !== null && frames[viewing] && <Viewer frames={frames} at={viewing} onAt={setViewing} onClose={() => setViewing(null)} />}
    </main>
  );
}
