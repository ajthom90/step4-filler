import { useEffect, useRef, useState } from 'preact/hooks';
import { addCause, editCause, removeCause } from '../../core/edit';
import { commitEdit, registerDraft } from '../store';
import { ItemList } from './ListStep';
import type { StepProps } from './types';

export function CausesStep({ doc, step, copy, update }: StepProps) {
  const entryId = step.entryId ?? '';
  const causes = doc.resentments.find((r) => r.id === entryId)?.causes ?? [];
  const [text, setText] = useState('');
  // What is typed, readable at once: the draft can be committed twice before the screen redraws.
  const typed = useRef('');
  const input = useRef<HTMLInputElement>(null);

  const commitDraft = () => {
    const pending = typed.current.trim();
    typed.current = '';
    setText('');
    if (pending === '') return;
    update((d) => addCause(d, entryId, pending));
    commitEdit(); // a cause added
  };
  useEffect(() => registerDraft(commitDraft));

  return (
    <>
      <form
        class="add"
        onSubmit={(e) => {
          e.preventDefault();
          commitDraft();
          input.current?.focus();
        }}
      >
        <label class="field">
          <span>{copy.addLabel}</span>
          <input ref={input} type="text" value={text} spellcheck={false} autocomplete="off" onInput={(e) => { typed.current = (e.currentTarget as HTMLInputElement).value; setText(typed.current); }} />
        </label>
        <button type="submit">Add cause</button>
      </form>
      <ItemList
        label="Causes so far"
        items={causes.map((c) => ({ id: c.id, text: c.text }))}
        onRename={(id, value) => update((d) => editCause(d, entryId, id, value))}
        onRemove={(id) => update((d) => removeCause(d, entryId, id))}
        warning="This also removes what you ticked for it."
      />
    </>
  );
}
