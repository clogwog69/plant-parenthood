import { ChevronRight, Droplet, LayoutGrid, List, Users } from 'lucide-react';
import { useState } from 'react';
import { dueLabel, plantName, waterPlan } from '../lib/care';
import type { Plant } from '../lib/types';
import { useStore } from '../store';
import { syncAvailable } from '../lib/sync';
import { Avatar, HouseholdSheet, Segmented } from '../ui/bits';

type Filter = 'all' | 'garden' | 'indoor';

export function Plants() {
  const { plants, view, setView, weather, location, house, syncState } = useStore();
  const [sharing, setSharing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const shown = plants.filter((p) => filter === 'all' || p.place === filter);

  const water = (p: Plant) => {
    const w = waterPlan(p, weather, location);
    const late = w.dueIn <= 0 && !w.skipped;
    return (
      <span className={'chip chip-water' + (late ? ' due' : '')}>
        <Droplet size={12} /> {w.skipped ? 'Rain coming' : w.dueIn <= 0 ? 'Today' : dueLabel(w.dueIn)}
      </span>
    );
  };

  return (
    <main className="screen">
      <header className="top">
        <div>
          <p className="eyebrow">{plants.length === 1 ? '1 plant' : `${plants.length} plants`}</p>
          <h1>My plants</h1>
        </div>
        <div className="view-toggle" role="group" aria-label="How to show plants">
          <button type="button" className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Photos"><LayoutGrid size={18} /></button>
          <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label="Names only"><List size={18} /></button>
        </div>
      </header>

      {syncAvailable && (
        <button type="button" className="house-bar" onClick={() => setSharing(true)}>
          <Users size={18} />
          <span>
            <b>{house ? house.name : 'Share with your household'}</b>
            <small>{house ? (syncState === 'offline' ? 'Offline, will catch up later' : 'Shared household') : 'Look after the same plants together'}</small>
          </span>
          <ChevronRight size={18} />
        </button>
      )}
      {sharing && <HouseholdSheet onClose={() => setSharing(false)} />}

      <Segmented
        value={filter} onChange={setFilter}
        options={[{ value: 'all', label: 'All' }, { value: 'garden', label: 'Garden' }, { value: 'indoor', label: 'Indoors' }]}
      />

      {shown.length === 0 ? (
        <section className="empty small">
          <h2>{plants.length ? 'Nothing here yet' : 'No plants yet'}</h2>
          <p>{plants.length ? `You have not added any ${filter === 'garden' ? 'garden' : 'indoor'} plants.` : 'Add one and it will show up here.'}</p>
          <a className="btn btn-primary" href="#/add">Add a plant</a>
        </section>
      ) : view === 'grid' ? (
        <ul className="grid">
          {shown.map((p) => (
            <li key={p.id}>
              <a href={`#/plant/${p.id}`} className="card-plant">
                <Avatar plant={p} className="fill" />
                <b>{plantName(p)}</b>
                <small>{p.nickname ? p.species : p.place === 'garden' ? 'Garden' : 'Indoors'}</small>
                {water(p)}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="names">
          {shown.map((p) => (
            <li key={p.id}>
              <a href={`#/plant/${p.id}`}>
                <span>
                  <b>{plantName(p)}</b>
                  <small>{p.nickname ? `${p.species} · ` : ''}{p.place === 'garden' ? 'Garden' : 'Indoors'}</small>
                </span>
                {water(p)}
                <ChevronRight size={18} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
