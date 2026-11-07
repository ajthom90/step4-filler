import { useState } from 'preact/hooks';
import { setField } from '../../core/edit';
import { Definitions, HelpSheet } from '../HelpSheet';
import type { StepProps } from './types';

/** Tick boxes: what one resentment cause affected, or what a harm aroused. */
export function TicksStep({ doc, step, copy, update, describedBy }: StepProps) {
  const [sheet, setSheet] = useState(false);
  const cause = doc.resentments.find((r) => r.id === step.entryId)?.causes.find((c) => c.id === step.causeId);
  const harm = doc.harms.find((h) => h.id === step.entryId);
  const ticked = (step.inventory === 'harms' ? harm : cause?.affects) as unknown as Record<string, boolean> | undefined;
  if (!ticked) return <p>This one is no longer in your list.</p>;
  return (
    <>
      {cause && <p class="cause" data-testid="cause">{cause.text}</p>}
      <fieldset aria-describedby={describedBy}>
        <legend>Tap everything that applies</legend>
        <ul class="plain choices">
          {(copy.options ?? []).map((o) => (
            <li key={o.value}>
              <label class="choice">
                <input
                  type="checkbox"
                  checked={ticked[o.value] === true}
                  onChange={(e) => update((d) => setField(d, { ...step, field: o.value }, (e.currentTarget as HTMLInputElement).checked))}
                />
                <span>{o.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {copy.help && (
        <>
          <p><button type="button" onClick={() => setSheet(true)}>What do these words mean?</button></p>
          <HelpSheet open={sheet} title="What these words mean" onClose={() => setSheet(false)}>
            <Definitions items={copy.help} />
          </HelpSheet>
        </>
      )}
    </>
  );
}
