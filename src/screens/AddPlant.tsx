import { Check, ChevronLeft, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { back, go } from '../App';
import { DAY } from '../lib/care';
import { CATEGORY_LABEL, searchGuides, type Match } from '../lib/guide';
import type { Shot } from '../lib/photo';
import type { Category, Place } from '../lib/types';
import { useStore } from '../store';
import { PhotoPicker, Segmented } from '../ui/bits';

type Watered = 'today' | 'yesterday' | 'days' | 'unsure';
const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

export function AddPlant() {
  const { addPlant } = useStore();
  const [shot, setShot] = useState<Shot>();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Match | null>(null);
  const [custom, setCustom] = useState<Category | null>(null);
  const [place, setPlace] = useState<Place>('garden');
  const [potted, setPotted] = useState<'pot' | 'ground'>('pot');
  const [nickname, setNickname] = useState('');
  const [watered, setWatered] = useState<Watered>('unsure');

  const matches = useMemo(() => searchGuides(query), [query]);
  const name = query.trim();
  const isCustom = !picked && name.length > 1 && (matches.length === 0 || name.length > 4);
  const ready = !!picked || (isCustom && !!custom);

  const save = () => {
    if (!ready) return;
    const now = Date.now();
    const lastWatered = watered === 'today' ? now : watered === 'yesterday' ? now - DAY : watered === 'days' ? now - 3 * DAY : undefined;
    const species = picked ? picked.label : name.charAt(0).toUpperCase() + name.slice(1);
    const plant = addPlant({
      guideKey: picked ? picked.guide.key : `custom:${custom}`,
      species,
      nickname: nickname.trim(),
      place,
      potted: place === 'indoor' || potted === 'pot',
      lastWatered,
      shot,
    });
    window.history.replaceState(null, '', '#/plants');
    go(`/plant/${plant.id}`);
  };

  return (
    <main className="screen form">
      <header className="bar">
        <button type="button" className="icon-btn" onClick={() => back('/')} aria-label="Back"><ChevronLeft size={22} /></button>
        <h1>New plant</h1>
      </header>

      <PhotoPicker shot={shot} onShot={setShot} label="Take a photo" />
      <p className="hint">A photo is optional. Spotting the plant from the photo automatically is coming later, so for now tell Sprout what it is.</p>

      <section className="group">
        <h2>What is it?</h2>
        {picked ? (
          <div className="picked">
            <span><b>{picked.label}</b><small>{picked.guide.latin} · {CATEGORY_LABEL[picked.guide.category]}</small></span>
            <button type="button" className="icon-btn" onClick={() => { setPicked(null); setQuery(''); }} aria-label="Change plant"><X size={18} /></button>
          </div>
        ) : (
          <>
            <label className="field search">
              <Search size={18} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Basil, tomato, monstera…" autoComplete="off" autoCapitalize="words" />
            </label>
            {matches.length > 0 && (
              <ul className="pick-list">
                {matches.map((m) => (
                  <li key={m.guide.key}>
                    <button type="button" onClick={() => setPicked(m)}>
                      {m.label}
                      <small>{m.label !== m.guide.name ? `cared for like ${m.guide.name.toLowerCase()}` : CATEGORY_LABEL[m.guide.category]}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {isCustom && (
              <div className="custom">
                <p>{matches.length ? 'Not one of those?' : 'Sprout does not know that one yet.'} Pick the closest type and it will use sensible care for “{name}”.</p>
                <div className="chips">
                  {CATEGORIES.map((c) => (
                    <button key={c} type="button" className={'chip-btn' + (custom === c ? ' on' : '')} onClick={() => setCustom(c)}>{CATEGORY_LABEL[c]}</button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="group">
        <h2>Where does it live?</h2>
        <Segmented value={place} onChange={setPlace} options={[{ value: 'garden', label: 'Garden' }, { value: 'indoor', label: 'Indoors' }]} />
        {place === 'garden' && (
          <Segmented value={potted} onChange={setPotted} options={[{ value: 'pot', label: 'In a pot' }, { value: 'ground', label: 'In the ground' }]} />
        )}
      </section>

      <section className="group">
        <h2>When was it last watered?</h2>
        <div className="chips">
          {([['today', 'Today'], ['yesterday', 'Yesterday'], ['days', 'A few days ago'], ['unsure', 'Not sure']] as [Watered, string][]).map(([v, l]) => (
            <button key={v} type="button" className={'chip-btn' + (watered === v ? ' on' : '')} onClick={() => setWatered(v)}>{l}</button>
          ))}
        </div>
      </section>

      <section className="group">
        <h2>Nickname <span className="optional">optional</span></h2>
        <label className="field">
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Kitchen basil, Big Fern…" maxLength={40} />
        </label>
      </section>

      <div className="sticky-cta">
        <button type="button" className="btn btn-primary wide" disabled={!ready} onClick={save}>
          <Check size={18} /> Add plant
        </button>
      </div>
    </main>
  );
}
