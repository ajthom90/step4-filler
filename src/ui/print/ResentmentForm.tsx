import { saveCopy } from '../../content/copy';
import { fill, contextFor } from '../../content/fill';
import { AFFECT_OPTIONS, RESENTMENT_STUDY_NOTE, copy, screens } from '../../content/resentments';
import type { InventoryDoc } from '../../core/doc';
import { Foot, FormSection, padTo, Scroll, Tick, Val } from './parts';

const p = saveCopy.print;
const MIN_ENTRIES = 3;
const MIN_CAUSE_ROWS = 4;
const DEFECTS = [
  ['selfish', screens.defects.selfish.label],
  ['dishonest', screens.defects.dishonest.label],
  ['selfSeeking', screens.defects.selfSeeking.label],
  ['frightened', screens.defects.frightened.label],
] as const;

export function ResentmentForm({ doc }: { doc: InventoryDoc }) {
  const ctx = contextFor(doc.settings);
  const say = (s: string) => fill(s, ctx);
  const col = copy.columns;
  return (
    <FormSection id="print-resentments" title={p.titles.resentments} landscape>
      <div class="paper-intro">
        <p><strong>{p.instructionsLabel}</strong> {say(copy.instructions)}</p>
        <p>{say(col['4'].hint)}</p>
        <p><strong>{p.dontForget}</strong> {say(RESENTMENT_STUDY_NOTE)}</p>
      </div>
      <Scroll label={p.previews.resentments}>
        <table class="print-form resentments" aria-labelledby="print-resentments">
          <colgroup>
            <col class="c-name" /><col class="c-cause" />
            {AFFECT_OPTIONS.map((a) => <col key={a.key} class="c-tick" />)}
            <col class="c-defects" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>{col['1'].heading} (1)</th>
              <th scope="col" rowSpan={2}>{col['2'].heading} (2)</th>
              <th scope="colgroup" colSpan={AFFECT_OPTIONS.length}>{col['3'].heading} (3)</th>
              <th scope="col" rowSpan={2}>{col['4'].heading} (4)</th>
            </tr>
            <tr>
              {AFFECT_OPTIONS.map((a) => <th key={a.key} scope="col" class="turned"><span>{a.label}</span></th>)}
            </tr>
          </thead>
          {padTo(doc.resentments, MIN_ENTRIES).map((entry, i) => {
            const causes = entry?.causes ?? [];
            const rows = Math.max(MIN_CAUSE_ROWS, causes.length);
            return (
              <tbody key={entry?.id ?? `blank-${i}`}>
                {Array.from({ length: rows }, (_, j) => {
                  const cause = causes[j];
                  return (
                    <tr key={j}>
                      {j === 0 && <td rowSpan={rows}>{entry && <Val text={entry.name} />}</td>}
                      <td>{cause && <Val text={cause.text} />}</td>
                      {AFFECT_OPTIONS.map((a) => <td key={a.key} class="tick"><Tick on={cause?.affects[a.key] ?? false} /></td>)}
                      {j === 0 && (
                        <td rowSpan={rows} class="defects">
                          {DEFECTS.map(([key, label]) => (
                            <div key={key} class="defect"><strong>{label}:</strong>{entry && <Val text={entry[key]} />}</div>
                          ))}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
          <Foot cols={AFFECT_OPTIONS.length + 3} />
        </table>
      </Scroll>
    </FormSection>
  );
}
