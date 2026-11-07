import { useEffect, useRef, useState } from 'preact/hooks';
import { pledgeCopy } from '../../content/pledge';
import { PRESETS } from '../../content/presets';
import type { InventoryDoc } from '../../core/doc';
import { ItemList } from '../steps/ListStep';
import { registerDraft, useApp } from '../store';

type ListKey = 'listA' | 'listB';
type Pledge = InventoryDoc['pledge'];

export function Pledge() {
  const { state, update } = useApp();
  const doc = state.doc!;
  const preset = PRESETS[doc.settings.preset];
  const [text, setText] = useState({ listA: '', listB: '' });
  // What is typed, readable at once: the draft can be committed twice before the screen redraws.
  const typed = useRef({ listA: '', listB: '' });
  const inputs = { listA: useRef<HTMLInputElement>(null), listB: useRef<HTMLInputElement>(null) };

  const patch = (fn: (p: Pledge) => Partial<Pledge>) => update((d) => ({ ...d, pledge: { ...d.pledge, ...fn(d.pledge) } }));
  const add = (key: ListKey) => {
    const value = typed.current[key].trim();
    typed.current[key] = '';
    setText((t) => ({ ...t, [key]: '' }));
    if (value !== '') patch((p) => ({ [key]: [...p[key], value] }));
  };
  // Whatever is typed but not added is added before the screen changes or the page is hidden.
  useEffect(() => registerDraft(() => { add('listA'); add('listB'); }));

  const section = (key: ListKey, heading: string) => (
    <section>
      <h2>{heading}</h2>
      <form class="add" onSubmit={(e) => { e.preventDefault(); add(key); inputs[key].current?.focus(); }}>
        <label class="field">
          <span>{pledgeCopy.addTo(heading)}</span>
          <input
            ref={inputs[key]}
            type="text"
            value={text[key]}
            spellcheck={false}
            autocomplete="off"
            onInput={(e) => { typed.current[key] = (e.currentTarget as HTMLInputElement).value; setText((t) => ({ ...t, [key]: typed.current[key] })); }}
          />
        </label>
        <button type="submit" aria-label={pledgeCopy.addButton(heading)}>Add</button>
      </form>
      <ItemList
        label={pledgeCopy.listLabel(heading)}
        items={doc.pledge[key].map((t, i) => ({ id: String(i), text: t }))}
        onRename={(id, value) => patch((p) => ({ [key]: p[key].map((t, i) => (String(i) === id ? value : t)) }))}
        onRemove={(id) => patch((p) => ({ [key]: p[key].filter((_, i) => String(i) !== id) }))}
        warning={pledgeCopy.removeWarning}
      />
    </section>
  );

  return (
    <>
      <h1 tabIndex={-1}>{pledgeCopy.title}</h1>
      <p class="note">{pledgeCopy.optionalNote}</p>
      {section('listA', preset.pledgeListA)}
      {section('listB', preset.pledgeListB)}
      <p class="lead">{preset.pledgeText}</p>
      <label class="field">
        <span>{pledgeCopy.signatureLabel}</span>
        <input type="text" value={doc.pledge.name} spellcheck={false} autocomplete="off" onInput={(e) => { const v = (e.currentTarget as HTMLInputElement).value; patch(() => ({ name: v })); }} />
      </label>
      <label class="field">
        <span>{pledgeCopy.dateLabel}</span>
        <input type="text" value={doc.pledge.date} spellcheck={false} autocomplete="off" onInput={(e) => { const v = (e.currentTarget as HTMLInputElement).value; patch(() => ({ date: v })); }} />
      </label>
      <p><a href="#/home">Back to your inventory</a></p>
    </>
  );
}
