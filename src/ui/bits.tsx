import { Camera, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, ImagePlus, LocateFixed, Search, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { guideFor } from '../lib/guide';
import { shoot, type Shot } from '../lib/photo';
import type { Location, Plant } from '../lib/types';
import { currentPosition, searchPlaces, type Sky } from '../lib/weather';
import { useStore } from '../store';

export function Avatar({ plant, className = '' }: { plant: Pick<Plant, 'guideKey' | 'species' | 'thumb'>; className?: string }) {
  const cat = guideFor(plant.guideKey, plant.species).category;
  return (
    <span className={`avatar cat-${cat} ${className}`}>
      {plant.thumb ? <img src={plant.thumb} alt="" /> : <span className="avatar-letter">{plant.species.charAt(0).toUpperCase()}</span>}
    </span>
  );
}

const SKY = { sun: Sun, partly: CloudSun, cloud: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: CloudSnow, storm: CloudLightning };

export function SkyIcon({ sky, size = 20 }: { sky: Sky; size?: number }) {
  const I = SKY[sky];
  return <I size={size} strokeWidth={1.75} />;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: NoInfer<T>; label: string }[]; onChange: (v: NoInfer<T>) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A tile that opens the camera (or photo library) and hands back a resized photo. */
export function PhotoPicker({ shot, onShot, label, className = '' }: { shot?: Shot; onShot(s: Shot): void; label: string; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <button type="button" className={`photo-pick ${shot ? 'has' : ''} ${className}`} onClick={() => input.current?.click()}>
        {shot ? (
          <>
            <img src={shot.full} alt="Your photo" />
            <span className="photo-retake"><Camera size={16} /> Retake</span>
          </>
        ) : (
          <span className="photo-empty">
            <ImagePlus size={28} strokeWidth={1.5} />
            <b>{busy ? 'One moment…' : label}</b>
            {error && <small>{error}</small>}
          </span>
        )}
      </button>
      <input
        ref={input} type="file" accept="image/*" hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true); setError('');
          try { onShot(await shoot(file)); } catch { setError('That photo would not open. Try another.'); }
          setBusy(false);
        }}
      />
    </>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', on);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', on); document.body.style.overflow = ''; };
  }, [onClose]);
  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function LocationSheet({ onClose }: { onClose(): void }) {
  const { location, setLocation } = useStore();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const [note, setNote] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    let off = false;
    const t = setTimeout(() => {
      searchPlaces(q)
        .then((r) => { if (!off) { setResults(r); setNote(r.length ? '' : 'No town found with that name.'); } })
        .catch(() => { if (!off) setNote('Could not search right now. Check your connection.'); });
    }, 300);
    return () => { off = true; clearTimeout(t); };
  }, [q]);

  const pick = (l: Location) => { setLocation(l); onClose(); };

  return (
    <Sheet title="Where do your plants live?" onClose={onClose}>
      <p className="muted">Sprout uses your local forecast to time watering, and to warn you about frost and heat.</p>
      <button
        type="button" className="btn btn-soft wide" disabled={locating}
        onClick={() => {
          setLocating(true); setNote('');
          currentPosition().then(pick).catch(() => { setLocating(false); setNote('Could not get your location. Search for your town instead.'); });
        }}
      >
        <LocateFixed size={18} /> {locating ? 'Finding you…' : 'Use my current location'}
      </button>
      <label className="field search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Or search for your town" autoComplete="off" />
      </label>
      {note && <p className="muted small">{note}</p>}
      <ul className="pick-list">
        {results.map((r) => (
          <li key={`${r.lat},${r.lon}`}><button type="button" onClick={() => pick(r)}>{r.name}</button></li>
        ))}
      </ul>
      {location && !q && <p className="muted small">Currently set to {location.name}.</p>}
    </Sheet>
  );
}
