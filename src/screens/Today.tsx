import { Camera, Check, CloudRain, Droplet, Flame, MapPin, Scissors, Shovel, Snowflake, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { go } from '../App';
import { DAY, alertsFor, allTasks, dueLabel, plantName, seasonFor, startOfDay } from '../lib/care';
import { syncAvailable } from '../lib/sync';
import type { Plant, Task } from '../lib/types';
import { describe } from '../lib/weather';
import { useStore } from '../store';
import { Avatar, HouseholdSheet, LocationSheet, SkyIcon } from '../ui/bits';

const DID = { watered: 'watered', repotted: 'repotted', harvested: 'picked from', added: 'added' };

function when(t: number): string {
  const time = new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return t >= startOfDay(Date.now()) ? time : `Yesterday, ${time}`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function TaskIcon({ task }: { task: Task }) {
  const kind = task.kind === 'todo' ? task.todo?.kind : task.kind;
  if (task.skipped) return <CloudRain size={15} />;
  if (kind === 'water') return <Droplet size={15} />;
  if (kind === 'repot') return <Shovel size={15} />;
  if (kind === 'harvest' || kind === 'prune') return <Scissors size={15} />;
  if (kind === 'photo') return <Camera size={15} />;
  return <Sparkles size={15} />;
}

export function taskTone(task: Task): string {
  const kind = task.kind === 'todo' ? task.todo?.kind : task.kind;
  if (kind === 'water') return 'water';
  if (kind === 'repot' || kind === 'care') return 'clay';
  return 'green';
}

export function useTaskDone() {
  const { log, completeTodo } = useStore();
  return (task: Task) => {
    if (task.kind === 'photo') go(`/plant/${task.plantId}/checkin`);
    else if (task.kind === 'todo' && task.todo) completeTodo(task.plantId, task.todo.id);
    else if (task.kind === 'water') log(task.plantId, 'watered');
    else if (task.kind === 'repot') log(task.plantId, 'repotted');
    else if (task.kind === 'harvest') log(task.plantId, 'harvested');
  };
}

function TaskRow({ task, plant, upcoming }: { task: Task; plant: Plant; upcoming?: boolean }) {
  const done = useTaskDone();
  const [open, setOpen] = useState(false);
  return (
    <li className={`task tone-${taskTone(task)}${task.skipped ? ' skipped' : ''}${upcoming ? ' upcoming' : ''}`}>
      <a href={`#/plant/${plant.id}`} aria-label={plantName(plant)}><Avatar plant={plant} /></a>
      <button type="button" className="task-body" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="task-title"><span className="task-ico"><TaskIcon task={task} /></span>{task.title}</span>
        <span className="task-plant">
          {plantName(plant)}
          {upcoming ? ` · ${dueLabel(task.dueIn)}` : task.dueIn < 0 && !task.skipped ? <em> · {dueLabel(task.dueIn)}</em> : null}
        </span>
        <span className={'task-why' + (open ? ' open' : '')}>{task.reason}</span>
      </button>
      {!upcoming && !task.skipped && (
        <button type="button" className="check" onClick={() => done(task)} aria-label={task.kind === 'photo' ? 'Take the photo' : 'Mark as done'}>
          {task.kind === 'photo' ? <Camera size={18} /> : <Check size={20} strokeWidth={2.5} />}
        </button>
      )}
    </li>
  );
}

export function Today() {
  const { plants, weather, weatherFailed, location, house } = useStore();
  const [sheet, setSheet] = useState(false);
  const [sharing, setSharing] = useState(false);
  const lately = useMemo(() => {
    if (!house) return [];
    const since = startOfDay(Date.now()) - DAY;
    return plants
      .flatMap((p) => [
        ...p.events.filter((e) => e.by && e.date >= since).map((e) => ({ plant: p, date: e.date, by: e.by!, did: DID[e.type] })),
        ...p.checkins.filter((c) => c.by && c.date >= since).map((c) => ({ plant: p, date: c.date, by: c.by!, did: 'checked on' })),
      ])
      .sort((a, b) => b.date - a.date)
      .slice(0, 6);
  }, [plants, house]);
  const byId = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);
  const tasks = useMemo(() => allTasks(plants, weather, location), [plants, weather, location]);
  const alerts = useMemo(() => alertsFor(plants, weather), [plants, weather]);
  const now = tasks.filter((t) => t.dueIn <= 0);
  const later = tasks.filter((t) => t.dueIn > 0 && t.dueIn <= 6);
  const todo = now.filter((t) => !t.skipped).length;

  const idx = weather ? weather.days.findIndex((d) => d.date === weather.today) : -1;
  const today = weather && idx >= 0 ? weather.days[idx] : null;

  return (
    <main className="screen">
      <header className="top">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>{greeting()}</h1>
        </div>
        <button type="button" className="pill" onClick={() => setSheet(true)}>
          <MapPin size={15} /> {location ? location.name.split(',')[0] : 'Set location'}
        </button>
      </header>

      {weather && today ? (
        <section className="weather">
          <div className="weather-now">
            <SkyIcon sky={describe(weather.code).sky} size={40} />
            <div>
              <div className="temp">{Math.round(weather.temp)}°</div>
              <div className="weather-label">
                {describe(weather.code).label} · {Math.round(today.tmin)}° to {Math.round(today.tmax)}°
                {today.rain >= 1 ? ` · ${Math.round(today.rain)} mm rain` : ''}
              </div>
            </div>
          </div>
          <ol className="forecast">
            {weather.days.slice(idx + 1, idx + 6).map((d) => (
              <li key={d.date}>
                <span>{new Date(d.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' })}</span>
                <SkyIcon sky={describe(d.code).sky} size={18} />
                <b>{Math.round(d.tmax)}°</b>
                <small>{d.rain >= 1 ? `${Math.round(d.rain)} mm` : ' '}</small>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <button type="button" className="weather weather-empty" onClick={() => setSheet(true)}>
          <MapPin size={22} />
          <span>
            <b>{location ? (weatherFailed ? 'Forecast unavailable' : 'Fetching the forecast…') : 'Add your location'}</b>
            <small>
              {location
                ? weatherFailed ? `Using typical ${seasonFor(location)} timings until you are back online.` : 'One moment.'
                : 'So watering follows your real weather, and you get frost and heat warnings.'}
            </small>
          </span>
        </button>
      )}

      {alerts.map((a) => (
        <div key={a.kind} className={`alert alert-${a.kind}`}>
          {a.kind === 'frost' ? <Snowflake size={20} /> : <Flame size={20} />}
          <div><b>{a.title}</b><p>{a.detail}</p></div>
        </div>
      ))}

      {plants.length === 0 ? (
        <section className="empty">
          <img className="empty-logo" src="./logo.png" alt="" width="150" height="150" />
          <h2>Start with one plant</h2>
          <p>Add the basil on the windowsill or the lemon tree out the back. Plant Parenthood will tell you when it needs water, a trim or a bigger pot.</p>
          <a className="btn btn-primary" href="#/add">Add your first plant</a>
          {syncAvailable && !house && <button type="button" className="link" onClick={() => setSharing(true)}>Joining someone's household? Enter their code</button>}
        </section>
      ) : (
        <>
          <section>
            <h2 className="section-title">Today {todo > 0 && <span className="count">{todo}</span>}</h2>
            {now.length ? (
              <ul className="tasks">{now.map((t) => <TaskRow key={t.id} task={t} plant={byId.get(t.plantId)!} />)}</ul>
            ) : (
              <p className="all-done">Nothing needs you today. Go and enjoy them.</p>
            )}
          </section>
          {later.length > 0 && (
            <section>
              <h2 className="section-title">Coming up</h2>
              <ul className="tasks">{later.map((t) => <TaskRow key={t.id} task={t} plant={byId.get(t.plantId)!} upcoming />)}</ul>
            </section>
          )}
        </>
      )}

      {lately.length > 0 && (
        <section>
          <h2 className="section-title">Lately</h2>
          <ul className="lately">
            {lately.map((l) => (
              <li key={`${l.plant.id}${l.date}${l.did}`}>
                <span><b>{l.by}</b> {l.did} <a href={`#/plant/${l.plant.id}`}>{plantName(l.plant)}</a></span>
                <small>{when(l.date)}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sheet && <LocationSheet onClose={() => setSheet(false)} />}
      {sharing && <HouseholdSheet onClose={() => setSharing(false)} />}
    </main>
  );
}
