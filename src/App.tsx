import { Leaf, Plus, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AddPlant } from './screens/AddPlant';
import { CheckinScreen } from './screens/Checkin';
import { Doctor } from './screens/Doctor';
import { PlantDetail } from './screens/PlantDetail';
import { Sitter } from './screens/Sitter';
import { Plants } from './screens/Plants';
import { Today } from './screens/Today';
import { useStore } from './store';

export const go = (path: string) => { window.location.hash = path; };
export const back = (fallback: string) => {
  if (window.history.length > 1) window.history.back();
  else go(fallback);
};

function useRoute(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => { setHash(window.location.hash); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash.replace(/^#/, '') || '/';
}

export function App() {
  const route = useRoute();
  const { ready } = useStore();
  // A plant sitter's link: just the watering plan, nothing of the household.
  const sit = route.match(/^\/sit\/([a-z0-9]+)$/);
  if (sit) return <div className="app"><Sitter token={sit[1]} /></div>;
  if (!ready) return <div className="app" />;

  const plant = route.match(/^\/plant\/([^/]+)(\/checkin)?$/);
  let screen;
  let tabs = true;
  if (plant?.[2]) { screen = <CheckinScreen id={plant[1]} />; tabs = false; }
  else if (plant) screen = <PlantDetail id={plant[1]} />;
  else if (route === '/add') { screen = <AddPlant />; tabs = false; }
  else if (route === '/doctor') { screen = <Doctor />; tabs = false; }
  else if (route === '/plants') screen = <Plants />;
  else screen = <Today />;

  return (
    <div className={'app' + (tabs ? ' has-tabs' : '')}>
      {screen}
      {tabs && (
        <nav className="tabs" aria-label="Main">
          <a href="#/" className={route === '/' ? 'on' : ''}><Sun size={22} /><span>Today</span></a>
          <a href="#/add" className="tab-add" aria-label="Add a plant"><Plus size={26} /></a>
          <a href="#/plants" className={route !== '/' ? 'on' : ''}><Leaf size={22} /><span>Plants</span></a>
        </nav>
      )}
    </div>
  );
}
