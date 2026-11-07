import { saveCopy } from '../../content/copy';
import { fill, contextFor } from '../../content/fill';
import { AROUSE_OPTIONS, EARNEST_PRAYERS, SEX_MEDITATION, SEX_PRAYER, copy } from '../../content/harms';
import type { InventoryDoc } from '../../core/doc';
import { Foot, FormSection, padTo, Scroll, Tick, Val } from './parts';

const p = saveCopy.print;
const MIN_ENTRIES = 3;
const WHERE = [
  ['selfish', 'Selfish'],
  ['dishonest', 'Dishonest'],
  ['inconsiderate', 'Inconsiderate'],
] as const;

export function HarmForm({ doc }: { doc: InventoryDoc }) {
  const ctx = contextFor(doc.settings);
  const say = (s: string) => fill(s, ctx);
  const col = copy.columns;
  const entries = padTo(doc.harms, MIN_ENTRIES);
  const totalRows = entries.length * WHERE.length;
  return (
    <FormSection id="print-harms" title={p.titles.harms} landscape>
      <div class="paper-intro">
        <p><strong>{p.instructionsLabel}</strong> {say(copy.instructions)}</p>
      </div>
      <Scroll label={p.previews.harms}>
        <table class="print-form harms" aria-labelledby="print-harms">
          <colgroup>
            <col class="c-whom" /><col class="c-where-label" /><col class="c-where" /><col class="c-arouse" /><col class="c-fault" />
            <col class="c-word" /><col class="c-yn" /><col class="c-sexprayer" /><col class="c-sexprayer" /><col class="c-earnest" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{col['1'].heading} (1)</th>
              <th scope="colgroup" colSpan={2}>{col['2'].heading} (2)</th>
              <th scope="col">{col['3'].heading} (3)</th>
              <th scope="col">{col['4'].heading} (4)</th>
              <th scope="colgroup" colSpan={2}>{col['5'].heading} (5)</th>
              <th scope="col">{col['6'].heading} {p.sexPage} (6)</th>
              <th scope="col">{col['7'].heading} {p.sexPage} (7)</th>
              <th scope="col">{p.earnestHeading} {p.earnestPage}</th>
            </tr>
          </thead>
          <tbody>
            {entries.flatMap((e, i) =>
              WHERE.map(([key, label], k) => (
                <tr key={`${e?.id ?? `blank-${i}`}-${key}`}>
                  {k === 0 && <td rowSpan={WHERE.length}>{e && <Val text={e.who} />}</td>}
                  <th scope="row" class="where-label">{label}:</th>
                  <td>{e && <Val text={e[key]} />}</td>
                  <td class="opt"><Tick on={e?.[AROUSE_OPTIONS[k].key] ?? false} /> {AROUSE_OPTIONS[k].label}?</td>
                  {k === 0 && <td rowSpan={WHERE.length}>{e && <Val text={e.fault} />}</td>}
                  {k === 0 && <td rowSpan={WHERE.length} class="word" aria-hidden="true">{[...'SELFISH'].map((c, n) => <span key={n}>{c}</span>)}</td>}
                  {k === 0 && (
                    <td rowSpan={WHERE.length} class="yn">
                      <div class="opt"><Tick on={e?.wasSelfish === 'yes'} /> Yes</div>
                      <div class="opt"><Tick on={e?.wasSelfish === 'no'} /> No</div>
                    </td>
                  )}
                  {k === 0 && <td rowSpan={WHERE.length} class="prayer-cell"><em>“{say(SEX_PRAYER)}”</em> <Tick on={e?.sexPrayerDone ?? false} /></td>}
                  {k === 0 && <td rowSpan={WHERE.length} class="prayer-cell"><em>“{say(SEX_MEDITATION)}”</em> <Tick on={e?.sexMeditationDone ?? false} /></td>}
                  {i === 0 && k === 0 && (
                    <td rowSpan={totalRows} class="earnest">
                      <p><strong>{EARNEST_PRAYERS.intro}</strong></p>
                      <ul class="plain">{EARNEST_PRAYERS.items.map((t) => <li key={t}>{t}</li>)}</ul>
                      {EARNEST_PRAYERS.closing.map((t) => <p key={t}>{t}</p>)}
                    </td>
                  )}
                </tr>
              )),
            )}
          </tbody>
          <Foot cols={10} />
        </table>
      </Scroll>
    </FormSection>
  );
}
