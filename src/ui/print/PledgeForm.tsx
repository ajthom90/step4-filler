import { pledgeCopy } from '../../content/pledge';
import { PRESETS } from '../../content/presets';
import type { InventoryDoc } from '../../core/doc';
import { Foot, FormSection, Val } from './parts';

const MIN_LINES = 14;

export function PledgeForm({ doc }: { doc: InventoryDoc }) {
  const preset = PRESETS[doc.settings.preset];
  const { listA, listB } = doc.pledge;
  const lines = Math.max(MIN_LINES, listA.length, listB.length);
  return (
    <FormSection id="print-pledge" title={pledgeCopy.title} landscape={false}>
      <table class="print-form pledge" aria-labelledby="print-pledge">
        <thead>
          <tr>
            <th scope="col">{preset.pledgeListA}</th>
            <th scope="col">{preset.pledgeListB}</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: lines }, (_, i) => (
            <tr key={i}>
              <td><Val text={listA[i] ?? ''} /></td>
              <td><Val text={listB[i] ?? ''} /></td>
            </tr>
          ))}
        </tbody>
        <tbody class="closing">
          <tr>
            <td colSpan={2}><p class="pledge-text">{preset.pledgeText}</p></td>
          </tr>
          <tr>
            <td colSpan={2} class="signature">
              <div class="line"><Val text={doc.pledge.name} /></div>
              <p>{pledgeCopy.signatureLabel}</p>
              <div class="line"><Val text={doc.pledge.date} /></div>
              <p>{pledgeCopy.dateLabel}</p>
            </td>
          </tr>
        </tbody>
        <Foot cols={2} />
      </table>
    </FormSection>
  );
}
