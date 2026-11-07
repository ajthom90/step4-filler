import { useEffect, useRef, useState } from 'preact/hooks';
import { addEntry, removeEntry } from '../../core/edit';
import { Definitions, HelpSheet } from '../HelpSheet';
import { listEntries } from '../stepCopy';
import type { StepProps } from './types';

/** Items with an inline "are you sure" before one is removed, since removing takes its answers with it. */
export function ItemList({ label, items, onRemove, warning }: { label: string; items: { id: string; text: string }[]; onRemove: (id: string) => void; warning: string }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  if (items.length === 0) return null;
  return (
    <ul class="plain items" aria-label={label}>
      {items.map((item) => (
        <li key={item.id}>
          <span class="item-text">{item.text}</span>
          {confirming === item.id ? (
            <span class="confirm" role="group" aria-label={`Remove ${item.text}?`}>
              <span class="note">{warning}</span>
              <button type="button" onClick={() => { setConfirming(null); onRemove(item.id); }}>Remove</button>
              <button type="button" onClick={() => setConfirming(null)}>Keep</button>
            </span>
          ) : (
            <button type="button" aria-label={`Remove ${item.text}`} onClick={() => setConfirming(item.id)}>Remove</button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ListStep({ doc, step, copy, update, draft }: StepProps) {
  const inv = step.inventory;
  const [text, setText] = useState('');
  const [sheet, setSheet] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const entries = listEntries(doc, inv);

  const pending = text.trim();
  draft.current = pending === '' ? null : (d) => addEntry(d, inv, pending);
  useEffect(() => () => { draft.current = null; }, [draft]);

  const add = (value: string) => {
    const v = value.trim();
    if (v === '') return;
    update((d) => addEntry(d, inv, v));
  };

  return (
    <>
      <form
        class="add"
        onSubmit={(e) => {
          e.preventDefault();
          add(text);
          setText('');
          input.current?.focus();
        }}
      >
        <label class="field">
          <span>{copy.addLabel}</span>
          <input ref={input} type="text" value={text} spellcheck={false} autocomplete="off" onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <button type="submit">Add</button>
      </form>
      {copy.prompts && (
        <p>
          <button type="button" onClick={() => setSheet(true)}>Show suggestions</button>
        </p>
      )}
      <ItemList
        label="Your list"
        items={entries}
        onRemove={(id) => update((d) => removeEntry(d, inv, id))}
        warning="This also removes everything you wrote about it."
      />
      <HelpSheet open={sheet} title="Suggestions" onClose={() => setSheet(false)}>
        <p class="note">Tap Add on anything that applies to you. Skip the rest.</p>
        <ul class="plain items">
          {(copy.prompts ?? []).map((p) => {
            const added = entries.some((e) => e.text === p);
            return (
              <li key={p}>
                <span class="item-text">{p}</span>
                <button type="button" disabled={added} aria-label={added ? `Added: ${p}` : `Add ${p}`} onClick={() => add(p)}>
                  {added ? 'Added' : 'Add'}
                </button>
              </li>
            );
          })}
        </ul>
        {copy.help && <Definitions items={copy.help} />}
      </HelpSheet>
    </>
  );
}
