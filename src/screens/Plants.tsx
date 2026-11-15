import { ArrowDownUp, Carrot, Droplet, FlaskConical, MoveRight, Scissors, Shovel, Sprout, ChevronRight, LayoutGrid, List, ScanSearch, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { plantName } from '../lib/care';
import { dueFor, saveSort, savedSort, SORTS, sortPlants, type SortKey } from '../lib/sort';
import type { Plant } from '../lib/types';
import { useStore } from '../store';
import { syncAvailable } from '../lib/sync';
import { Avatar, HouseholdSheet, Segmented } from '../ui/bits';

type Filter = 'all' | 'garden' | 'indoor';

const SORT_ICON: Record<SortKey, typeof Droplet> = {
  az: Droplet, water: Droplet, age: Sprout, prune: Scissors, repot: Shovel, feed: FlaskConical,
  harvest: Carrot, propagate: Sprout, move: MoveRight,
};

export function Plants() {
  const { plants, view, setView, weather, location, house, syncState } = useStore();
  const [sharing, setSharing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSortKey] = useState<SortKey>(savedSort);
  const setSort = (k: SortKey) => { setSortKey(k); saveSort(k); };
  const shown = useMemo(
    () => sortPlants(plants.filter((p) => filter === 'all' || p.place === filter), sort, weather, location),
    [plants, filter, sort, weather, location],
  );

  // The chip shows the job you sorted by. A–Z shows watering, the job that matters most.
  const water = (p: Plant) => {
    const d = dueFor(sort === 'az' ? 'water' : sort, p, weather, location)!;
    const Icon = SORT_ICON[sort];
    return (
      <span className={'chip chip-water' + (d.urgent ? ' due' : '') + (d.never ? ' never' : '')}>
        <Icon size={12} /> {d.label}
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
        <div className="top-actions">
        <a href="#/doctor" className="icon-btn doctor-btn" aria-label="Plant doctor"><ScanSearch size={19} /></a>
        <div className="view-toggle" role="group" aria-label="How to show plants">
          <button type="button" className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Photos"><LayoutGrid size={18} /></button>
          <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label="Names only"><List size={18} /></button>
        </div>
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

      {plants.length > 1 && (
        <div className="sort-row" role="group" aria-label="Sort by">
          <span className="sort-label"><ArrowDownUp size={14} /> Sort</span>
          {SORTS.map((s) => (
            <button key={s.value} type="button" className={'sort-chip' + (sort === s.value ? ' on' : '')} aria-pressed={sort === s.value} onClick={() => setSort(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      )}

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
