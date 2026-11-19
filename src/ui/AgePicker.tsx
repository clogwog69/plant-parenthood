import { STAGES } from '../lib/age';
import type { Stage } from '../lib/types';

/** "How old is it?" Babies get watered more often and are not fed or picked yet. */
export function AgePicker({ value, onChange }: { value: Stage | null; onChange(s: Stage | null): void }) {
  return (
    <section className="group">
      <h2>How old is it?</h2>
      <div className="chips">
        {STAGES.map((s) => (
          <button key={s.value} type="button" className={'chip-btn' + (value === s.value ? ' on' : '')} onClick={() => onChange(s.value)}>{s.label}</button>
        ))}
        <button type="button" className={'chip-btn' + (value === null ? ' on' : '')} onClick={() => onChange(null)}>Not sure</button>
      </div>
      <p className="muted small">{value ? STAGES.find((s) => s.value === value)!.hint + '. ' : ''}Young plants need water more often. It grows up in the app as the weeks go by.</p>
    </section>
  );
}
