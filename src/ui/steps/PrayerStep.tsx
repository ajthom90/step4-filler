import { setField } from '../../core/edit';
import type { StepProps } from './types';

/** A prayer to read, with a box to mark it done. Never blocks moving on. */
export function PrayerStep({ doc, step, copy, update }: StepProps) {
  const entry = (doc[step.inventory] as unknown as Array<Record<string, unknown>>).find((e) => e.id === step.entryId);
  return (
    <>
      <blockquote class="prayer" data-testid="prayer">{copy.prayer}</blockquote>
      <label class="choice">
        <input
          type="checkbox"
          checked={entry?.[step.field ?? ''] === true}
          onChange={(e) => update((d) => setField(d, step, (e.currentTarget as HTMLInputElement).checked))}
        />
        <span>I've said this prayer</span>
      </label>
    </>
  );
}
