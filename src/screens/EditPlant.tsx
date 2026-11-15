import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CATEGORY_LABEL, guideFor, searchGuides, type Match } from '../lib/guide';
import type { Place, Plant } from '../lib/types';
import { useStore } from '../store';
import { Segmented, Sheet } from '../ui/bits';

/** Move a plant indoors or out, into the ground, rename it, or fix what it is. */
export function EditPlantSheet({ plant, onClose }: { plant: Plant; onClose(): void }) {
  const { editPlant } = useStore();
  const [place, setPlace] = useState<Place>(plant.place);
  const [potted, setPotted] = useState<'pot' | 'ground'>(plant.potted ? 'pot' : 'ground');
  const [nickname, setNickname] = useState(plant.nickname ?? '');
  const [kind, setKind] = useState<Match | null>(null);
  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState('');
  const matches = useMemo(() => searchGuides(query), [query]);
  const g = guideFor(plant.guideKey, plant.species);

  const save = () => {
    editPlant(plant.id, {
      place,
      potted: place === 'indoor' || potted === 'pot',
      nickname,
      ...(kind ? { guideKey: kind.guide.key, species: kind.label } : {}),
    });
    onClose();
  };

  return (
    <Sheet title="Edit plant" onClose={onClose}>
      <section className="group">
        <h2>Where does it live?</h2>
        <Segmented value={place} onChange={setPlace} options={[{ value: 'garden', label: 'Garden' }, { value: 'indoor', label: 'Indoors' }]} />
        {place === 'garden' && (
          <Segmented value={potted} onChange={setPotted} options={[{ value: 'pot', label: 'In a pot' }, { value: 'ground', label: 'In the ground' }]} />
        )}
      </section>

      <section className="group">
        <h2>Nickname <span className="optional">optional</span></h2>
        <label className="field">
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Kitchen basil, Big Fern…" maxLength={40} />
        </label>
      </section>

      <section className="group">
        <h2>What is it?</h2>
        {!changing ? (
          <div className="picked">
            <span><b>{kind ? kind.label : plant.species}</b><small>{(kind ? kind.guide : g).latin} · {CATEGORY_LABEL[(kind ? kind.guide : g).category]}</small></span>
            <button type="button" className="link" onClick={() => { setChanging(true); setQuery(''); }}>Change</button>
          </div>
        ) : (
          <>
            <label className="field search">
              <Search size={18} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Basil, tomato, monstera…" autoComplete="off" autoCapitalize="words" autoFocus />
              <button type="button" className="icon-btn" onClick={() => setChanging(false)} aria-label="Keep it as it is"><X size={18} /></button>
            </label>
            {matches.length > 0 && (
              <ul className="pick-list">
                {matches.map((m) => (
                  <li key={m.guide.key}>
                    <button type="button" onClick={() => { setKind(m); setChanging(false); }}>
                      {m.label}
                      <small>{m.label !== m.guide.name ? `cared for like ${m.guide.name.toLowerCase()}` : CATEGORY_LABEL[m.guide.category]}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted small">Its photos, notes and watering history stay with it.</p>
          </>
        )}
      </section>

      <button type="button" className="btn btn-primary wide" onClick={save}>Save changes</button>
    </Sheet>
  );
}
