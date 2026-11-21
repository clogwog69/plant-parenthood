import { Plane, Bell, BellOff, Camera, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, ImagePlus, LocateFixed, RefreshCw, Search, Share, Share2, Smartphone, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { guideFor } from '../lib/guide';
import { shoot, type Shot } from '../lib/photo';
import { PUSH_CHOICES, disablePush, enablePush, getPrefs, needsHomeScreen, pushBlocked, pushIsOn, pushSupported, setPrefs, type PushPrefs } from '../lib/push';
import { canPrompt, device, installLater, onInstallChange, promptInstall, remindInstall } from '../lib/install';
import { cleanCode, prettyCode } from '../lib/sync';
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

/** A button that opens the camera or photo library and hands back a resized photo. */
export function PhotoButton({ onShot, className = 'btn btn-soft', disabled, children }: { onShot(s: Shot): void; className?: string; disabled?: boolean; children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => input.current?.click()}>{children}</button>
      <input
        ref={input} type="file" accept="image/*" hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try { onShot(await shoot(file)); } catch { window.alert('That photo would not open. Try another.'); }
        }}
      />
    </>
  );
}

function Notifications() {
  const { house, me } = useStore();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [prefs, setPrefsState] = useState(getPrefs);
  const [how, setHow] = useState(false);
  useEffect(() => { void pushIsOn().then(setOn); }, []);
  if (!house) return null;

  if (!pushSupported()) {
    return (
      <div className="notif">
        <BellOff size={20} />
        <div>
          <b>Notifications</b>
          <p>{needsHomeScreen()
            ? 'On an iPhone, reminders only work once the app is on your Home Screen.'
            : 'This browser cannot show notifications.'}</p>
          {needsHomeScreen() && <button type="button" className="link" onClick={() => setHow(true)}>Show me how</button>}
          {how && <InstallSheet onClose={() => setHow(false)} />}
        </div>
      </div>
    );
  }
  const toggle = async () => {
    setBusy(true); setNote('');
    try {
      if (on) { await disablePush(); setOn(false); }
      else { await enablePush(house.code, me); setOn(true); }
    } catch (e) { setNote(e instanceof Error ? e.message : 'Something went wrong. Try again.'); }
    setBusy(false);
  };
  const choose = async (key: keyof PushPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefsState(next); setNote('');
    try { await setPrefs(house.code, me, next); }
    catch { setPrefsState(prefs); setNote('Could not save that choice. Check your connection and try again.'); }
  };
  return (
    <div className="notif">
      {on ? <Bell size={20} /> : <BellOff size={20} />}
      <div>
        <b>{on ? 'Notifications are on' : 'Notifications'}</b>
        <p>{on ? 'Choose what this phone hears about.' : 'Get a morning list of jobs, and a ping when someone else waters or checks a plant. You choose which.'}</p>
        {on && (
          <ul className="choices">
            {PUSH_CHOICES.map((c) => (
              <li key={c.key}>
                <label>
                  <span><b>{c.label}</b><small>{c.detail}</small></span>
                  <input type="checkbox" role="switch" checked={prefs[c.key]} onChange={() => void choose(c.key)} />
                </label>
              </li>
            ))}
          </ul>
        )}
        {(note || pushBlocked()) && <p className="warn">{note || 'Notifications are blocked for this app. Allow them in your phone settings.'}</p>}
        <button type="button" className="link" disabled={busy || on === null} onClick={toggle}>{busy ? 'One moment…' : on ? 'Turn all off on this phone' : 'Turn on notifications'}</button>
      </div>
    </div>
  );
}

/** Settings, reached from the cog on Today. */
export function SettingsSheet({ onClose, onShare, onSitters }: { onClose(): void; onShare(): void; onSitters?(): void }) {
  const { house, me } = useStore();
  return (
    <Sheet title="Settings" onClose={onClose}>
      {house ? <Notifications /> : (
        <div className="notif">
          <BellOff size={20} />
          <div>
            <b>Notifications</b>
            <p>Notifications work once you share a household, even if it is just you in it.</p>
            <button type="button" className="link" onClick={onShare}>Set up a household</button>
          </div>
        </div>
      )}
      {house && onSitters && (
        <button type="button" className="doctor-card" onClick={onSitters}>
          <span className="doctor-ico"><Plane size={22} /></span>
          <span><b>Going away? Add a Bud-sitter</b><small>Give a friend the watering plan for the days you are gone.</small></span>
        </button>
      )}
      {house && <p className="muted small">{me ? `You are ${me}, in ${house.name}. ` : ''}These choices are for this phone only. Everyone else picks their own.</p>}
    </Sheet>
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
      <p className="muted">Plant Parenthood uses your local forecast to time watering, and to warn you about frost and heat.</p>
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

const SYNC_LABEL = { off: '', idle: 'Up to date', syncing: 'Syncing…', offline: 'Offline. Changes will send when you are back online.' };

/** Create, join or look at the shared household. */
export function HouseholdSheet({ onClose, initial = 'create' }: { onClose(): void; initial?: 'create' | 'join' }) {
  const { house, me, plants, syncState, createHouse, joinHouse, leaveHouse, syncNow } = useStore();
  const [mode, setMode] = useState<'create' | 'join'>(initial);
  const [name, setName] = useState(me);
  const [houseName, setHouseName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);

  if (house) {
    const pretty = prettyCode(house.code);
    const text = `Join our plants on Plant Parenthood. Open ${window.location.href.split('#')[0]} then tap Household and enter the code ${pretty}`;
    const share = async () => {
      try {
        if (navigator.share) await navigator.share({ text });
        else { await navigator.clipboard.writeText(pretty); setCopied(true); }
      } catch { /* closed the share sheet */ }
    };
    return (
      <Sheet title={house.name} onClose={onClose}>
        <p className="muted">Everyone with this code shares the same plants, photos and to-dos. Give it only to people in your household.</p>
        <div className="invite">
          <small>Invite code</small>
          <b>{pretty}</b>
        </div>
        <button type="button" className="btn btn-primary wide" onClick={share}><Share2 size={18} /> {copied ? 'Code copied' : 'Invite someone'}</button>
        <Notifications />
        <p className="muted small">{me ? `You are ${me}. ` : ''}{SYNC_LABEL[syncState]}</p>
        <button type="button" className="btn btn-soft wide" onClick={syncNow}><RefreshCw size={16} /> Check for changes now</button>
        <button
          type="button" className="btn btn-danger"
          onClick={() => { if (window.confirm('Leave this household? The plants stay on this phone but stop updating.')) { leaveHouse(); onClose(); } }}
        >
          Leave household
        </button>
      </Sheet>
    );
  }

  const ready = name.trim().length > 0 && (mode === 'create' || cleanCode(code).length >= 10);
  const submit = async () => {
    setBusy(true); setNote('');
    try {
      if (mode === 'create') await createHouse(houseName, name);
      else await joinHouse(code, name);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
    setBusy(false);
  };

  return (
    <Sheet title="Share with your household" onClose={onClose}>
      <p className="muted">Look after the same plants together. When one of you waters, everyone sees it.</p>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'create', label: 'Start a household' }, { value: 'join', label: 'I have a code' }]} />
      <label className="field"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" maxLength={24} autoComplete="given-name" /></label>
      {mode === 'create' ? (
        <label className="field"><input value={houseName} onChange={(e) => setHouseName(e.target.value)} placeholder="Household name, like Home" maxLength={40} /></label>
      ) : (
        <label className="field"><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Invite code" autoCapitalize="characters" autoComplete="off" spellCheck={false} /></label>
      )}
      {note && <p className="muted small">{note}</p>}
      <button type="button" className="btn btn-primary wide" disabled={!ready || busy} onClick={submit}>
        {busy ? 'One moment…' : mode === 'create' ? 'Start household' : 'Join household'}
      </button>
      {plants.length > 0 && <p className="muted small">The {plants.length === 1 ? 'plant' : `${plants.length} plants`} already on this phone will be shared too.</p>}
    </Sheet>
  );
}

/** How to put the app on the Home Screen, for the phone they are on. */
export function InstallSheet({ onClose }: { onClose(): void }) {
  const { house } = useStore();
  const [, redraw] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => onInstallChange(() => redraw((n) => n + 1)), []);
  const kind = device();
  const link = window.location.href.split('#')[0];
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* not allowed */ } };
  const iphone = kind === 'iphone-safari' || kind === 'iphone-other';

  return (
    <Sheet title={kind === 'computer' ? 'Use it on your phone' : 'Add it to your Home Screen'} onClose={onClose}>
      <p className="muted">
        {kind === 'computer'
          ? 'Plant Parenthood is made for phones. Open it there, add it to your Home Screen, and it can remind you when a plant needs water.'
          : 'Phones only send reminders to apps on the Home Screen. It takes a few seconds, and it opens full screen like any other app.'}
      </p>

      {kind === 'iphone-safari' && (
        <ol className="steps">
          <li>Tap the <b>Share</b> button <Share size={15} /> at the bottom of Safari</li>
          <li>Scroll down and tap <b>Add to Home Screen</b></li>
          <li>Tap <b>Add</b></li>
          <li>Open <b>Plant Parenthood</b> from your Home Screen</li>
        </ol>
      )}
      {kind === 'iphone-other' && (
        <>
          <ol className="steps">
            <li>Tap the <b>Share</b> button <Share size={15} /> next to the address bar</li>
            <li>Tap <b>Add to Home Screen</b> &gt; <b>Add</b></li>
            <li>Open <b>Plant Parenthood</b> from your Home Screen</li>
          </ol>
          <p className="muted small">Can’t see Add to Home Screen? Copy the link, open Safari, paste it in and follow the steps there.</p>
          <button type="button" className="btn btn-soft wide" onClick={copy}>{copied ? 'Link copied' : 'Copy the link'}</button>
        </>
      )}
      {kind === 'android' && (canPrompt() ? (
        <button type="button" className="btn btn-primary wide" onClick={() => void promptInstall().then((ok) => { if (ok) onClose(); })}>Install the app</button>
      ) : (
        <ol className="steps">
          <li>Tap <b>⋮</b> at the top right of Chrome</li>
          <li>Tap <b>Install app</b> or <b>Add to Home screen</b></li>
          <li>Tap <b>Install</b></li>
          <li>Open <b>Plant Parenthood</b> from your Home Screen</li>
        </ol>
      ))}
      {kind === 'computer' && (
        <>
          <ol className="steps">
            <li>Open this link on your phone</li>
            <li>Follow the steps it shows to add it to your Home Screen</li>
          </ol>
          <div className="invite"><small>Link</small><b className="link-text">{link.replace(/^https?:\/\//, '')}</b></div>
          <button type="button" className="btn btn-soft wide" onClick={copy}>{copied ? 'Link copied' : 'Copy the link'}</button>
        </>
      )}

      {iphone && (house
        ? <p className="muted small">The Home Screen app starts empty on an iPhone. To bring your plants, open it, tap Plants &gt; Share with your household &gt; I have a code, and enter <b>{prettyCode(house.code)}</b>.</p>
        : <p className="muted small">On an iPhone the Home Screen app starts empty, so add your plants there.</p>)}
      <p className="muted small">Then turn on reminders in the app: tap the cog on Today.</p>
    </Sheet>
  );
}

/** The reminder on Today for anyone still using a browser tab. */
export function InstallNudge() {
  const [show, setShow] = useState(remindInstall);
  const [open, setOpen] = useState(false);
  if (!show) return null;
  const computer = device() === 'computer';
  return (
    <>
      <div className="nudge">
        <Smartphone size={20} />
        <button type="button" className="nudge-body" onClick={() => setOpen(true)}>
          <b>{computer ? 'Use it on your phone' : 'Add it to your Home Screen'}</b>
          <small>{computer ? 'So it can remind you when plants need water.' : 'Then it can remind you when plants need water. Show me how.'}</small>
        </button>
        <button type="button" className="nudge-x" aria-label="Later" onClick={() => { installLater(); setShow(false); }}><X size={18} /></button>
      </div>
      {open && <InstallSheet onClose={() => setOpen(false)} />}
    </>
  );
}
