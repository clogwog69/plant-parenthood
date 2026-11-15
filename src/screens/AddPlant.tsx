import { Check, ChevronLeft, MapPin, ScanSearch, ScanText, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { back, go } from '../App';
import { aiMessage, runAI, type Identified, type TagRead } from '../lib/ai';
import { DAY, placement } from '../lib/care';
import { CATEGORY_LABEL, GUIDES, searchGuides, type Match } from '../lib/guide';
import type { Shot } from '../lib/photo';
import type { Category, Place, TagInfo } from '../lib/types';
import { useStore } from '../store';
import { PhotoButton, PhotoPicker, Segmented } from '../ui/bits';
import { TAG_FIELDS } from './PlantDetail';

type Watered = 'today' | 'yesterday' | 'days' | 'unsure';
const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

export function AddPlant() {
  const { addPlant, house, location } = useStore();
  const [tag, setTag] = useState<TagInfo>();
  const [busy, setBusy] = useState<'identify' | 'tag' | null>(null);
  const [aiNote, setAiNote] = useState('');
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

  /** Fill in the "What is it?" box from a name the photo or tag gave us. */
  const suggest = (found: string, category?: Category, careLike?: string) => {
    const exact = searchGuides(found).find((m) => m.label.toLowerCase() === found.toLowerCase());
    const like = careLike ? GUIDES.find((g) => g.key === careLike) : undefined;
    if (!exact && like) { setPicked({ guide: like, label: found }); setQuery(''); return; }
    const hit = exact ?? searchGuides(found)[0] ?? searchGuides(found.split(/\s+/).slice(-1)[0])[0];
    if (hit) { setPicked({ guide: hit.guide, label: hit.label }); setQuery(''); return; }
    setPicked(null);
    setQuery(found);
    if (category && CATEGORIES.includes(category)) setCustom(category);
  };

  const identify = async () => {
    if (!shot) return;
    setBusy('identify'); setAiNote('');
    try {
      const r = await runAI<Identified>('identify', {}, shot.full);
      const found = typeof r.name === 'string' ? r.name.trim().slice(0, 60) : '';
      if (!found) setAiNote('Could not tell what that is. Try a clearer photo, or type the name.');
      else {
        suggest(found, r.category, typeof r.careLike === 'string' ? r.careLike : undefined);
        setAiNote(`That looks like ${found}${r.latin ? ` (${r.latin})` : ''}${r.confidence === 'low' ? ', but it is hard to be sure' : ''}. Change it below if that is wrong.`);
      }
    } catch (e) { setAiNote(aiMessage(e)); }
    setBusy(null);
  };

  const scanTag = async (full: string) => {
    setBusy('tag'); setAiNote('');
    try {
      const t = await runAI<TagRead>('tag', {}, full);
      const next: TagInfo = { date: Date.now() };
      if (typeof t.name === 'string' && t.name.trim()) next.name = t.name.trim().slice(0, 80);
      for (const [k] of TAG_FIELDS) if (typeof t[k] === 'string' && t[k].trim()) next[k] = t[k].trim().slice(0, 400);
      if (Object.keys(next).length < 2) setAiNote('Could not read anything on that tag. Try again closer up, in good light.');
      else {
        setTag(next);
        if (next.name && !picked) suggest(next.name);
        setAiNote(`Tag read${next.name ? `: ${next.name}` : ''}. Its details will be saved with the plant.`);
      }
    } catch (e) { setAiNote(aiMessage(e)); }
    setBusy(null);
  };

  const spot = ready
    ? placement({ guideKey: picked ? picked.guide.key : `custom:${custom}`, species: picked ? picked.label : name, place, potted: place === 'indoor' || potted === 'pot' }, location)
    : null;

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
      tag,
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
      {house ? (
        <div className="scan-row">
          <button type="button" className="btn btn-soft" disabled={!shot || !!busy} onClick={() => void identify()}>
            <ScanSearch size={18} /> {busy === 'identify' ? 'Looking…' : 'Name it for me'}
          </button>
          <PhotoButton disabled={!!busy} onShot={(s) => void scanTag(s.full)}>
            <ScanText size={18} /> {busy === 'tag' ? 'Reading…' : tag ? 'Tag saved' : 'Scan its tag'}
          </PhotoButton>
        </div>
      ) : null}
      <p className="hint">
        {aiNote || (house
          ? (busy ? 'This takes up to a minute.' : 'Take a photo and tap "Name it for me", or photograph the tag it came with.')
          : 'A photo is optional. Once you share a household, the app can name the plant from its photo and read its tag.')}
      </p>

      <section className="group">
        <h2>What is it?</h2>
        {picked ? (
          <div className="picked">
            <span><b>{picked.label}</b><small>{[picked.guide.name, ...(picked.guide.aka ?? [])].some((n) => n.toLowerCase() === picked.label.toLowerCase()) ? `${picked.guide.latin} · ${CATEGORY_LABEL[picked.guide.category]}` : `Cared for like ${picked.guide.name.toLowerCase()}`}</small></span>
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
                <p>{matches.length ? 'Not one of those?' : 'We do not know that one yet.'} Pick the closest type and it will use sensible care for “{name}”.</p>
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
        {spot && (
          <div className="spot">
            <span className="spot-ico"><MapPin size={20} /></span>
            <div><b>Best spot: {spot.title.charAt(0).toLowerCase() + spot.title.slice(1)}</b><p>{spot.detail}</p></div>
          </div>
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
