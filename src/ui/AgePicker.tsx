import { ScanSearch } from 'lucide-react';
import { STAGES } from '../lib/age';
import type { Stage } from '../lib/types';

/** "How old is it?" Babies get watered more often and are not fed or picked yet. */
export function AgePicker({ value, onChange, guessed, onGuess, guessing, note }: {
  value: Stage | null; onChange(s: Stage | null): void;
  /** The stage a photo suggested, so the hint can say so. */
  guessed?: Stage | null;
  onGuess?: () => void; guessing?: boolean; note?: string;
}) {
  return (
    <section className="group">
      <h2>How old is it?</h2>
      <div className="chips">
        {STAGES.map((s) => (
          <button key={s.value} type="button" className={'chip-btn' + (value === s.value ? ' on' : '')} onClick={() => onChange(s.value)}>{s.label}</button>
        ))}
        <button type="button" className={'chip-btn' + (value === null ? ' on' : '')} onClick={() => onChange(null)}>Not sure</button>
      </div>
      <p className="muted small">{value && guessed === value ? 'Guessed from the photo. Tap another if that is wrong. ' : value ? STAGES.find((s) => s.value === value)!.hint + '. ' : ''}Young plants need water more often. It grows up in the app as the weeks go by.</p>
      {onGuess && (
        <button type="button" className="link" onClick={onGuess} disabled={guessing}><ScanSearch size={15} /> {guessing ? 'Looking at the photo…' : 'Guess from the latest photo'}</button>
      )}
      {note && <p className="muted small">{note}</p>}
    </section>
  );
}
