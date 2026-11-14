import { Camera, Check, ChevronLeft, Droplet, Scissors, Shovel, Sun, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { back, go } from '../App';
import { ago, dueLabel, plantName, repotStatus, seasonFor, tasksFor, waterPlan } from '../lib/care';
import { SIGN_LABEL } from '../lib/checkin';
import { CATEGORY_LABEL, guideFor } from '../lib/guide';
import type { EventType } from '../lib/types';
import { useStore, usePhoto } from '../store';
import { Avatar } from '../ui/bits';
import { TaskIcon, taskTone, useTaskDone } from './Today';

const EVENT: Record<EventType, string> = { watered: 'Watered', repotted: 'Repotted', harvested: 'Harvested', added: 'Added to Plant Parenthood' };

export function PlantDetail({ id }: { id: string }) {
  const { plants, weather, location, log, removePlant } = useStore();
  const plant = plants.find((p) => p.id === id);
  const photo = usePhoto(plant?.photoId);
  const done = useTaskDone();

  useEffect(() => { if (!plant) go('/plants'); }, [plant]);
  if (!plant) return null;

  const g = guideFor(plant.guideKey, plant.species);
  const water = waterPlan(plant, weather, location);
  const repot = repotStatus(plant, location);
  const season = seasonFor(location);
  const jobs = tasksFor(plant, weather, location).filter((t) => t.kind !== 'water' && t.dueIn <= 0);
  const inSeason = g.harvest && (!g.harvest.seasons || g.harvest.seasons.includes(season));

  const journal = [
    ...plant.checkins.map((c) => ({ date: c.date, checkin: c, event: null as EventType | null, by: c.by })),
    ...plant.events.map((e) => ({ date: e.date, checkin: null, event: e.type as EventType | null, by: e.by })),
  ].sort((a, b) => b.date - a.date).slice(0, 40);

  const wateredBy = plant.events.find((e) => e.type === 'watered' && e.date === plant.lastWatered)?.by;

  const waterHead = water.skipped ? 'Skip watering, rain is coming'
    : water.dueIn < 0 ? `Water now (${dueLabel(water.dueIn).toLowerCase()})`
    : water.dueIn === 0 ? 'Water today'
    : `Water ${dueLabel(water.dueIn).toLowerCase()}`;

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
        <h2 className="section-title">Care guide</h2>
        <dl className="guide">
          <div><dt><Droplet size={16} /> Water</dt><dd>{g.water}</dd></div>
          <div><dt><Sun size={16} /> Light</dt><dd>{g.light}</dd></div>
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

      <section>
        <h2 className="section-title">Journal</h2>
        <ol className="journal">
          {journal.map((j, i) => j.checkin ? (
            <li key={j.checkin.id} className="entry">
              {j.checkin.thumb ? <img src={j.checkin.thumb} alt="" /> : <Avatar plant={{ ...plant, thumb: undefined }} />}
              <div>
                <b>Check-in <small>{ago(j.date)}{j.by ? ` · ${j.by}` : ''}</small></b>
                {j.checkin.signs.length > 0 && <p className="signs">{j.checkin.signs.map((s) => SIGN_LABEL[s]).join(' · ')}</p>}
                {j.checkin.advice.map((a) => <p key={a.sign}><strong>{a.title}.</strong> {a.detail}</p>)}
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
    </main>
  );
}
