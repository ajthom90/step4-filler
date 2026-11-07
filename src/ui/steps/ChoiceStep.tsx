import { setField } from '../../core/edit';
import type { StepProps } from './types';

/** One answer from a short list, such as Yes or No. The options come from the step's copy. */
export function ChoiceStep({ doc, step, copy, update, describedBy }: StepProps) {
  const entry = (doc[step.inventory] as unknown as Array<Record<string, unknown>>).find((e) => e.id === step.entryId);
  const current = entry?.[step.field ?? ''] ?? null;
  return (
    <fieldset aria-describedby={describedBy}>
      <legend>Choose one</legend>
      <ul class="plain choices">
        {(copy.options ?? []).map((o) => (
          <li key={o.value}>
            <label class="choice">
              <input type="radio" name={step.key} checked={current === o.value} onChange={() => update((d) => setField(d, step, o.value))} />
              <span>{o.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
