import { Copy, Mail, Share2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { addSitter, listSitters, removeSitter, sitLink, type Sitter } from '../lib/sync';
import { useStore } from '../store';
import { Sheet } from './bits';

const iso = (t: number) => { const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const nice = (s: string) => new Date(s + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function invite(s: Sitter, house: string) {
  const subject = `Minding the plants at ${house}`;
  const body = `Hi ${s.name},\n\nThanks for looking after our plants from ${nice(s.starts)} to ${nice(s.ends)}. This link shows which ones need water each day, and you can tick them off as you go. No app or sign-up needed:\n\n${sitLink(s.token)}\n\nThank you!`;
  return { subject, body };
}

/** Plant sitters: someone who minds the plants while the household is away. */
export function SittersSheet({ onClose }: { onClose(): void }) {
  const { house } = useStore();
  const [list, setList] = useState<Sitter[] | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [starts, setStarts] = useState(iso(Date.now()));
  const [ends, setEnds] = useState(iso(Date.now() + 7 * 86_400_000));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!house) return;
    listSitters(house.code).then(setList).catch(() => { setList([]); setNote('Could not load your plant sitters. Check your connection.'); });
  }, [house]);

  if (!house) return null;

  const add = async () => {
    if (!name.trim()) { setNote('Add their name first.'); return; }
    if (ends < starts) { setNote('The last day needs to be after the first day.'); return; }
    setBusy(true); setNote('');
    try {
      const token = await addSitter(house.code, name.trim(), email.trim(), starts, ends);
      if (!token) throw new Error('no token');
      const s: Sitter = { token, name: name.trim(), email: email.trim() || null, starts, ends };
      setList((l) => [...(l ?? []), s]);
      setName(''); setEmail('');
      if (s.email) send(s);
    } catch { setNote('Could not make the link. Check your connection, or the database may need its plant sitter update.'); }
    setBusy(false);
  };

  const send = (s: Sitter) => {
    const { subject, body } = invite(s, house.name);
    window.location.href = `mailto:${encodeURIComponent(s.email ?? '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  const share = async (s: Sitter) => {
    const { body } = invite(s, house.name);
    try {
      if (typeof navigator.share === 'function') { await navigator.share({ text: body }); return; }
    } catch { return; }
    await navigator.clipboard?.writeText(sitLink(s.token)).catch(() => {});
    setCopied(s.token);
  };
  const remove = async (s: Sitter) => {
    if (!confirm(`Stop ${s.name}'s link? They will not be able to see the plants any more.`)) return;
    try { await removeSitter(house.code, s.token); setList((l) => (l ?? []).filter((x) => x.token !== s.token)); }
    catch { setNote('Could not remove that. Check your connection.'); }
  };

  return (
    <Sheet title="Plant sitters" onClose={onClose}>
      <p className="muted">Going away? Give a friend a private link with the watering plan for those days. They can tick plants off as they water, and you will see it here. The link stops working the day after.</p>

      {list && list.length > 0 && (
        <section className="group">
          <h2>Your plant sitters</h2>
          <ul className="tasks">
            {list.map((s) => (
              <li key={s.token} className="sitter-row">
                <div>
                  <b>{s.name}</b>
                  <small>{nice(s.starts)} to {nice(s.ends)}{s.email ? ` · ${s.email}` : ''}</small>
                  {copied === s.token && <small>Link copied</small>}
                </div>
                <div className="sitter-acts">
                  {s.email && <button type="button" className="icon-btn" onClick={() => send(s)} aria-label={`Email ${s.name} the link`}><Mail size={18} /></button>}
                  <button type="button" className="icon-btn" onClick={() => share(s)} aria-label={`Share ${s.name}'s link`}>{typeof navigator.share === 'function' ? <Share2 size={18} /> : <Copy size={18} />}</button>
                  <button type="button" className="icon-btn" onClick={() => remove(s)} aria-label={`Stop ${s.name}'s link`}><Trash2 size={18} /></button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="group">
        <h2>Add a plant sitter</h2>
        <label className="field"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name" maxLength={40} /></label>
        <label className="field"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email (optional)" maxLength={120} autoComplete="off" /></label>
        <div className="dates">
          <label>First day<input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} /></label>
          <label>Last day<input type="date" value={ends} min={starts} onChange={(e) => setEnds(e.target.value)} /></label>
        </div>
        {note && <p className="hint">{note}</p>}
        <button type="button" className="btn btn-primary wide" disabled={busy} onClick={add}>
          {busy ? 'Making the link…' : email.trim() ? 'Make the link and email it' : 'Make the link'}
        </button>
      </section>
    </Sheet>
  );
}
