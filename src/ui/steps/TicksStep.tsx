import { useState } from 'preact/hooks';
import type { Affects } from '../../core/doc';
import { setField } from '../../core/edit';
import { Definitions, HelpSheet } from '../HelpSheet';
import type { StepProps } from './types';

/** Resentment column 3: what one cause affected. */
export function TicksStep({ doc, step, copy, update }: StepProps) {
  const [sheet, setSheet] = useState(false);
  const cause = doc.resentments.find((r) => r.id === step.entryId)?.causes.find((c) => c.id === step.causeId);
  if (!cause) return <p>This one is no longer in your list.</p>;
  return (
    <>
      <p class="cause" data-testid="cause">{cause.text}</p>
      <fieldset>
        <legend>Tap everything that applies</legend>
        <ul class="plain choices">
          {(copy.options ?? []).map((o) => (
            <li key={o.value}>
              <label class="choice">
                <input
                  type="checkbox"
                  checked={cause.affects[o.value as keyof Affects]}
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
