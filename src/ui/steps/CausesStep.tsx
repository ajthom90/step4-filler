import { useEffect, useRef, useState } from 'preact/hooks';
import { addCause, removeCause } from '../../core/edit';
import { ItemList } from './ListStep';
import type { StepProps } from './types';

export function CausesStep({ doc, step, copy, update, draft }: StepProps) {
  const entryId = step.entryId ?? '';
  const causes = doc.resentments.find((r) => r.id === entryId)?.causes ?? [];
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const pending = text.trim();
  draft.current = pending === '' ? null : (d) => addCause(d, entryId, pending);
  useEffect(() => () => { draft.current = null; }, [draft]);

  return (
    <>
      <form
        class="add"
        onSubmit={(e) => {
          e.preventDefault();
          if (pending !== '') update((d) => addCause(d, entryId, pending));
          setText('');
          input.current?.focus();
        }}
      >
        <label class="field">
          <span>{copy.addLabel}</span>
          <input ref={input} type="text" value={text} spellcheck={false} autocomplete="off" onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <button type="submit">Add cause</button>
      </form>
      <ItemList
        label="Causes so far"
        items={causes.map((c) => ({ id: c.id, text: c.text }))}
        onRemove={(id) => update((d) => removeCause(d, entryId, id))}
        warning="This also removes what you ticked for it."
      />
    </>
  );
}
