import { useState } from 'preact/hooks';
import { checklistCopy, FLAW_FOOTNOTES, FLAWS, OTHER_FLAWS_LABEL } from '../../content/checklist';
import { useApp } from '../store';

export function Checklist() {
  const { state, update } = useApp();
  const { selected, other } = state.doc!.checklist;
  const [query, setQuery] = useState('');
  const words = query.toLowerCase().split(/\s+/).filter((w) => w !== '');
  const shown = FLAWS.filter((f) => {
    const hay = `${f.defect} ${f.opposite}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const toggle = (id: string, on: boolean) =>
    update((d) => ({
      ...d,
      checklist: { ...d.checklist, selected: on ? [...d.checklist.selected.filter((s) => s !== id), id] : d.checklist.selected.filter((s) => s !== id) },
    }));
  return (
    <>
      <h1 tabIndex={-1}>{checklistCopy.title}</h1>
      <p>{checklistCopy.intro}</p>
      <label class="field">
        <span>{checklistCopy.searchLabel}</span>
        <input type="text" value={query} spellcheck={false} autocomplete="off" onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
      </label>
      {shown.length === 0 && <p role="status">{checklistCopy.noMatches}</p>}
      <ul class="plain flaws">
        {shown.map((f) => (
          <li key={f.id}>
            <label class="choice flaw">
              <input type="checkbox" checked={selected.includes(f.id)} onChange={(e) => toggle(f.id, (e.currentTarget as HTMLInputElement).checked)} />
              <span>
                <span class="flaw-defect">{f.defect}</span>
                <span class="note">{checklistCopy.oppositeLabel} {f.opposite}</span>
                {f.sources.length > 0 && <span class="note">{checklistCopy.sourcesLabel} {f.sources.join(', ')}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <label class="field">
        <span>{OTHER_FLAWS_LABEL}</span>
        <textarea
          value={other}
          spellcheck={false}
          autocomplete="off"
          onInput={(e) => {
            const value = (e.currentTarget as HTMLTextAreaElement).value;
            update((d) => ({ ...d, checklist: { ...d.checklist, other: value } }));
          }}
        />
      </label>
      <h2>{checklistCopy.sourcesHeading}</h2>
      <p class="note">{checklistCopy.sourcesIntro}</p>
      <dl class="defs">
        {Object.entries(FLAW_FOOTNOTES).map(([n, text]) => (
          <div key={n}>
            <dt>{n}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <p><a href="#/home">Back to your inventory</a></p>
    </>
  );
}
