import { useEffect, useRef, useState } from 'preact/hooks';
import { addEntry, removeEntry, renameEntry } from '../../core/edit';
import { Definitions, HelpSheet } from '../HelpSheet';
import { listEntries } from '../stepCopy';
import { registerDraft } from '../store';
import type { StepProps } from './types';

/**
 * Items with Edit and Remove. Editing keeps the item's answers; removing takes them away, so it asks first.
 * `noun` completes the edit label, as in "Change Pat".
 */
export function ItemList({ label, items, onRename, onRemove, warning }: {
  label: string;
  items: { id: string; text: string }[];
  onRename: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  warning: string;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  if (items.length === 0) return null;
  const save = () => {
    if (editing && editing.text.trim() !== '') onRename(editing.id, editing.text.trim());
    setEditing(null);
  };
  return (
    <ul class="plain items" aria-label={label}>
      {items.map((item) => (
        <li key={item.id}>
          {editing?.id === item.id ? (
            <form class="edit" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <label class="field">
                <span>Change {item.text}</span>
                <input
                  type="text"
                  value={editing.text}
                  spellcheck={false}
                  autocomplete="off"
                  ref={(el) => el?.focus()}
                  onInput={(e) => setEditing({ id: item.id, text: (e.currentTarget as HTMLInputElement).value })}
                />
              </label>
              <button type="submit" class="primary">Save</button>
              <button type="button" onClick={() => setEditing(null)}>Cancel</button>
            </form>
          ) : (
            <>
              <span class="item-text">{item.text}</span>
              {confirming === item.id ? (
                <span class="confirm" role="group" aria-label={`Remove ${item.text}?`}>
                  <span class="note">{warning}</span>
                  <button type="button" onClick={() => { setConfirming(null); onRemove(item.id); }}>Remove</button>
                  <button type="button" onClick={() => setConfirming(null)}>Keep</button>
                </span>
              ) : (
                <span class="row-actions">
                  <button type="button" aria-label={`Edit ${item.text}`} onClick={() => setEditing({ id: item.id, text: item.text })}>Edit</button>
                  <button type="button" aria-label={`Remove ${item.text}`} onClick={() => setConfirming(item.id)}>Remove</button>
                </span>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ListStep({ doc, step, copy, update }: StepProps) {
  const inv = step.inventory;
  const [text, setText] = useState('');
  // What is typed, readable at once: the draft can be committed twice before the screen redraws.
  const typed = useRef('');
  const [sheet, setSheet] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const entries = listEntries(doc, inv);

  const add = (value: string) => {
    const v = value.trim();
    if (v === '') return;
    update((d) => addEntry(d, inv, v));
  };
  // Whatever is typed but not added is added before the screen changes or the page is hidden.
  const commitDraft = () => {
    const pending = typed.current;
    typed.current = '';
    setText('');
    add(pending);
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
        onRename={(id, name) => update((d) => renameEntry(d, inv, id, name))}
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
