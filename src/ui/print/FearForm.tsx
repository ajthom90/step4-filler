import { saveCopy } from '../../content/copy';
import { fill, contextFor } from '../../content/fill';
import { FEAR_PRAYER, FEAR_PRAYER_DONE_LABEL, TRUST_OPTIONS, copy } from '../../content/fears';
import type { InventoryDoc } from '../../core/doc';
import { Foot, FormSection, padTo, Scroll, Tick, Val } from './parts';

const p = saveCopy.print;
const MIN_ENTRIES = 8;

export function FearForm({ doc }: { doc: InventoryDoc }) {
  const ctx = contextFor(doc.settings);
  const say = (s: string) => fill(s, ctx);
  const col = copy.columns;
  return (
    <FormSection id="print-fears" title={p.titles.fears} landscape>
      <div class="paper-intro">
        <p><strong>{p.instructionsLabel}</strong> {say(copy.instructions)}</p>
      </div>
      <Scroll label={p.previews.fears}>
        <table class="print-form fears" aria-labelledby="print-fears">
          <colgroup>
            <col class="c-fear" /><col class="c-why" /><col class="c-trust" /><col class="c-trust" />
            <col class="c-yn" /><col class="c-yn" /><col class="c-prayer" /><col class="c-be" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{col['1'].heading} (1)</th>
              <th scope="col">{col['2'].heading} (2)</th>
              <th scope="colgroup" colSpan={2}>{say(col['3'].heading)} (3)</th>
              <th scope="colgroup" colSpan={2}>{col['4'].heading} (4)</th>
              <th scope="col"><strong>{col['5'].heading}:</strong> “{say(FEAR_PRAYER)}” (5)</th>
              <th scope="col"><strong>{say(col['6'].heading)}</strong> {say(col['6'].hint)} (6)</th>
            </tr>
          </thead>
          <tbody>
            {padTo(doc.fears, MIN_ENTRIES).map((e, i) => (
              <tr key={e?.id ?? `blank-${i}`}>
                <td>{e && <Val text={e.fear} />}</td>
                <td>{e && <Val text={e.why} />}</td>
                <td class="opt"><Tick on={e?.trust === 'god'} /> {say(TRUST_OPTIONS.god)}</td>
                <td class="opt"><Tick on={e?.trust === 'self'} /> {TRUST_OPTIONS.self}</td>
                <td class="opt"><Tick on={e?.selfRelianceWorked === 'yes'} /> Yes</td>
                <td class="opt"><Tick on={e?.selfRelianceWorked === 'no'} /> No</td>
                <td class="prayer-cell"><span>{FEAR_PRAYER_DONE_LABEL}</span> <Tick on={e?.prayerDone ?? false} /></td>
                <td>{e && <Val text={e.beWhat} />}</td>
              </tr>
            ))}
          </tbody>
          <Foot cols={8} />
        </table>
      </Scroll>
    </FormSection>
  );
}
