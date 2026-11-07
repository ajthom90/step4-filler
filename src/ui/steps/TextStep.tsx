import { useState } from 'preact/hooks';
import { setField } from '../../core/edit';
import { Definitions, HelpSheet } from '../HelpSheet';
import type { StepProps } from './types';

export function TextStep({ doc, step, copy, update, describedBy }: StepProps) {
  const [sheet, setSheet] = useState(false);
  const entry = (doc[step.inventory] as unknown as Array<Record<string, unknown>>).find((e) => e.id === step.entryId);
  const stored = entry?.[step.field ?? ''];
  return (
    <>
      <textarea
        aria-labelledby="step-question"
        aria-describedby={describedBy}
        rows={7}
        value={typeof stored === 'string' ? stored : ''}
        spellcheck={false}
        autocomplete="off"
        onInput={(e) => {
          const value = (e.currentTarget as HTMLTextAreaElement).value;
          update((d) => setField(d, step, value));
        }}
      />
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
