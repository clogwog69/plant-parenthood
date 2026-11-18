import { Check, Eraser, Sun, Thermometer } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { plantName } from '../lib/care';
import { clock, daylight, hotDay, hourLabel, lightName, lightShort, lightsFor, MIDDAY, mismatches, needsMiddayShade, runs, wants, type Light } from '../lib/sun';
import type { Plant } from '../lib/types';
import { useStore } from '../store';

const span = (from: number, to: number) => `${hourLabel(from)}–${hourLabel(to)}`;

function Bar({ hours, at, label }: { hours: number[]; at: (h: number) => Light | undefined; label: string }) {
  return (
    <div className="sunbar" style={{ gridTemplateColumns: `repeat(${hours.length}, 1fr)` }} role="img" aria-label={label}>
      {hours.map((h) => <span key={h} className={'sun-h l-' + (at(h) ?? 'none')} />)}
    </div>
  );
}

function Ticks({ hours }: { hours: number[] }) {
  return (
    <div className="sun-ticks" style={{ gridTemplateColumns: `repeat(${hours.length}, 1fr)` }} aria-hidden>
      {hours.map((h) => <span key={h}>{h % 3 === 0 ? hourLabel(h) : ''}</span>)}
    </div>
  );
}

/** What the plant wants through the day, and what it actually gets where it lives. */
export function SunBars({ plant }: { plant: Plant }) {
  const { location, weather, setSun } = useStore();
  const day = useMemo(() => daylight(location), [location]);
  const { hours } = day;
  const want = useMemo(() => wants(plant, hours), [plant.guideKey, plant.species, plant.place, hours]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState(false);
  const [brush, setBrush] = useState<Light | 'clear'>('full');
  useEffect(() => setBrush('full'), [plant.place]);
  const [draft, setDraft] = useState<Record<number, Light>>(plant.sun ?? {});
  const painting = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const barRef = useRef<HTMLDivElement>(null);

  // Another phone changed it while we were not editing.
  useEffect(() => { if (!editing) setDraft(plant.sun ?? {}); }, [plant.sun, editing]);

  const gets = editing ? draft : plant.sun ?? {};
  const marked = hours.some((h) => gets[h]);
  const off = mismatches({ ...plant, sun: gets }, hours);
  const hot = plant.place === 'garden' && needsMiddayShade(plant) ? hotDay(weather) : null;
  const shadedAtMidday = MIDDAY.every((h) => gets[h] && gets[h] !== 'full');
  const name = plantName(plant);
  const wantRuns = runs(hours, (h) => want[h]);
  const where = plant.place;
  const L = (l: Light) => lightName(l, where);
  const lower = (l: Light) => L(l).charAt(0).toLowerCase() + L(l).slice(1);
  const swatches = lightsFor(where);

  const paintAt = (x: number) => {
    const r = barRef.current?.getBoundingClientRect();
    if (!r) return;
    const h = hours[Math.min(hours.length - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * hours.length)))];
    setDraft((d) => {
      if (brush === 'clear' ? !d[h] : d[h] === brush) return d;
      const next = { ...d };
      if (brush === 'clear') delete next[h]; else next[h] = brush;
      return next;
    });
  };
  const save = (sun: Record<number, Light>) => setSun(plant.id, sun);

  return (
    <div className="sun">
      {hot && (
        <div className={'sun-hot' + (shadedAtMidday ? ' ok' : '')}>
          <Thermometer size={18} />
          <p>
            <b>{hot.today ? 'Hot today' : 'Hot tomorrow'} ({Math.round(hot.tmax)}°).</b>{' '}
            {shadedAtMidday ? `${name} is in shade from 11am to 2pm, which is just right.` : `Move ${name} into shade from 11am to 2pm${plant.potted ? '' : ', or rig up some shade cloth'}.`}
          </p>
        </div>
      )}

      <div className="sun-head">
        <span><Sun size={14} /> {day.rise ? `Sunrise ${clock(day.rise)}` : 'Morning'}</span>
        <span>{day.set ? `Sunset ${clock(day.set)}` : 'Evening'}</span>
      </div>

      <h3 className="sun-title">What it needs {where === 'indoor' ? 'indoors' : 'outside'}</h3>
      <Bar hours={hours} at={(h) => want[h]} label={wantRuns.map((r) => `${span(r.from, r.to)} ${L(r.light)}`).join(', ')} />
      <Ticks hours={hours} />
      <p className="sun-say">
        {wantRuns.length === 1
          ? `${L(wantRuns[0].light)} all day.`
          : wantRuns.map((r) => `${L(r.light)} ${span(r.from, r.to)}`).join(', then ') + '.'}
      </p>

      <h3 className="sun-title">What it gets {!editing && <button type="button" className="link-btn" onClick={() => { setDraft(plant.sun ?? {}); setEditing(true); }}>{marked ? 'Change' : 'Mark it'}</button>}</h3>
      <div
        ref={barRef}
        className={'sun-edit' + (editing ? ' on' : '')}
        onClick={editing ? undefined : () => { setDraft(plant.sun ?? {}); setEditing(true); }}
        onPointerDown={editing ? (e) => { painting.current = true; e.currentTarget.setPointerCapture(e.pointerId); paintAt(e.clientX); } : undefined}
        onPointerMove={(e) => { if (editing && painting.current) paintAt(e.clientX); }}
        onPointerUp={() => { if (painting.current) { painting.current = false; save(draftRef.current); } }}
        onPointerCancel={() => { painting.current = false; }}
      >
        <Bar hours={hours} at={(h) => gets[h]} label={marked ? runs(hours, (h) => gets[h]).map((r) => `${span(r.from, r.to)} ${L(r.light)}`).join(', ') : 'Not marked yet'} />
      </div>
      <Ticks hours={hours} />

      {editing ? (
        <div className="sun-tools">
          <p className="muted small">Pick a colour, then tap or slide along the hours.</p>
          <div className="sun-swatches" role="radiogroup" aria-label="Colour">
            {swatches.map((l) => (
              <button key={l.value} type="button" role="radio" aria-checked={brush === l.value} className={'swatch' + (brush === l.value ? ' on' : '')} onClick={() => setBrush(l.value)}>
                <span className={'dot l-' + l.value} /> {lightShort(l.value, where)}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={brush === 'clear'} className={'swatch' + (brush === 'clear' ? ' on' : '')} onClick={() => setBrush('clear')}>
              <Eraser size={14} /> Rub out
            </button>
          </div>
          <div className="sun-actions">
            <button type="button" className="btn btn-soft" onClick={() => { setDraft(want); save(want); }}>Copy from above</button>
            <button type="button" className="btn btn-primary" onClick={() => { save(draft); setEditing(false); }}><Check size={16} /> Done</button>
          </div>
        </div>
      ) : !marked ? (
        <p className="muted small">Mark how much sun it gets where it sits now, hour by hour, to see if it needs a move.</p>
      ) : null}

      {marked && !editing && (
        off.length ? (
          <ul className="sun-off">
            {off.map((o) => (
              <li key={o.from}><b>{span(o.from, o.to)}</b> It gets {lower(o.gets)}, but it needs {lower(o.want)}.</li>
            ))}
          </ul>
        ) : hours.every((h) => gets[h]) ? (
          <p className="sun-good"><Check size={14} /> It gets what it needs. Good spot.</p>
        ) : null
      )}

      <div className="sun-key">
        {swatches.map((l) => <span key={l.value}><i className={'dot l-' + l.value} /> {L(l.value)}</span>)}
      </div>
    </div>
  );
}
