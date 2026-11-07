import { FLAWS, FLAW_FOOTNOTES, OTHER_FLAWS_LABEL, checklistCopy } from '../../content/checklist';
import { saveCopy } from '../../content/copy';
import type { InventoryDoc } from '../../core/doc';
import { Foot, FormSection, Scroll, Tick, Val } from './parts';

const p = saveCopy.print;
const GROUPS = 3;

export function ChecklistForm({ doc }: { doc: InventoryDoc }) {
  const picked = new Set(doc.checklist.selected);
  // The handout runs down its first column, then the second, then the third.
  const rows = Math.ceil(FLAWS.length / GROUPS);
  return (
    <FormSection id="print-checklist" title={p.titles.checklist} landscape>
      <Scroll label={p.previews.checklist}>
        <table class="print-form checklist" aria-labelledby="print-checklist">
          <colgroup>
            {Array.from({ length: GROUPS }, (_, g) => [
              <col key={`t${g}`} class="c-flaw-tick" />,
              <col key={`d${g}`} class="c-flaw" />,
              <col key={`o${g}`} class="c-flaw-opposite" />,
            ])}
          </colgroup>
          <thead>
            <tr>
              {Array.from({ length: GROUPS }, (_, g) => [
                <th key={`t${g}`} scope="col" aria-label={p.ticked} />,
                <th key={`d${g}`} scope="col">Character Defect</th>,
                <th key={`o${g}`} scope="col" class="right">Opposite Aspect</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: GROUPS }, (_, g) => {
                  const flaw = FLAWS[g * rows + r];
                  if (!flaw) return [<td key={`t${g}`} />, <td key={`d${g}`} />, <td key={`o${g}`} />];
                  return [
                    <td key={`t${g}`} class="tick"><Tick on={picked.has(flaw.id)} /></td>,
                    <td key={`d${g}`}>
                      {flaw.defect}
                      {flaw.sources.length > 0 && <sup>{flaw.sources.join(',')}</sup>}
                    </td>,
                    <td key={`o${g}`} class="right">{flaw.opposite}</td>,
                  ];
                })}
              </tr>
            ))}
          </tbody>
          <tbody class="notes">
            <tr>
              <td colSpan={GROUPS * 3}>
                <p><strong>{OTHER_FLAWS_LABEL}</strong></p>
                <Val text={doc.checklist.other} />
              </td>
            </tr>
            <tr>
              <td colSpan={GROUPS * 3}>
                <p><strong>{checklistCopy.sourcesHeading}</strong></p>
                <ol class="plain">
                  {Object.entries(FLAW_FOOTNOTES).map(([n, text]) => <li key={n}><sup>{n}</sup> {text}</li>)}
                </ol>
              </td>
            </tr>
          </tbody>
          <Foot cols={GROUPS * 3} />
        </table>
      </Scroll>
    </FormSection>
  );
}
