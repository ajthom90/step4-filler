import { useEffect, useRef, useState } from 'preact/hooks';
import { checklistCopy } from '../../content/checklist';
import { saveCopy } from '../../content/copy';
import { pledgeCopy } from '../../content/pledge';
import { rememberOpener } from '../HelpSheet';
import { INVENTORY_TITLES } from '../stepInfo';
import { useApp } from '../store';
import { ChecklistForm } from '../print/ChecklistForm';
import { FearForm } from '../print/FearForm';
import { HarmForm } from '../print/HarmForm';
import { PledgeForm } from '../print/PledgeForm';
import { ResentmentForm } from '../print/ResentmentForm';
import '../print.css';

const p = saveCopy.print;

type Section = 'resentments' | 'fears' | 'harms' | 'checklist' | 'pledge';
const SECTIONS: { key: Section; label: string }[] = [
  { key: 'resentments', label: INVENTORY_TITLES.resentments },
  { key: 'fears', label: INVENTORY_TITLES.fears },
  { key: 'harms', label: INVENTORY_TITLES.harms },
  { key: 'checklist', label: checklistCopy.title },
  { key: 'pledge', label: `${pledgeCopy.title} (optional)` },
];

/** A native dialog, so focus stays inside it and Escape closes it. It is closed before printing starts. */
function PrintWarning({ open, onCancel, onContinue }: { open: boolean; onCancel: () => void; onContinue: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const restore = useRef<(() => void) | null>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      restore.current = rememberOpener();
      d.showModal();
    }
    if (!open && d.open) {
      d.close();
      restore.current?.(); // back to the button that asked, whether the person cancelled or went on to print
      restore.current = null;
    }
  }, [open]);
  return (
    <dialog ref={dialog} class="sheet warning" aria-labelledby="print-warning-title" onClose={onCancel}>
      <div class="sheet-head">
        <h2 id="print-warning-title">{p.warnHeading}</h2>
      </div>
      <div class="sheet-body">
        <p>{p.warnText}</p>
        <p class="actions">
          <button type="button" class="primary" onClick={onContinue}>{p.warnContinue}</button>
          <button type="button" onClick={onCancel}>{p.warnCancel}</button>
        </p>
      </div>
    </dialog>
  );
}

export function Print() {
  const { state } = useApp();
  const doc = state.doc!;
  const pledgeStarted = doc.pledge.listA.length + doc.pledge.listB.length > 0;
  // The optional pledge is only included when it has been started, or when it is chosen here.
  const [chosen, setChosen] = useState<Record<Section, boolean>>({ resentments: true, fears: true, harms: true, checklist: true, pledge: pledgeStarted });
  const [warning, setWarning] = useState(false);
  const any = SECTIONS.some((s) => chosen[s.key]);

  const printNow = () => {
    setWarning(false);
    // Let the dialog finish closing, so it is not in the print.
    setTimeout(() => window.print(), 0);
  };

  return (
    <>
      <h1 tabIndex={-1} class="no-print">{p.title}</h1>
      <div class="no-print">
        <p>{p.intro}</p>
        <fieldset>
          <legend>{p.chooseLegend}</legend>
          <ul class="plain choices">
            {SECTIONS.map((s) => (
              <li key={s.key}>
                <label class="choice">
                  <input type="checkbox" checked={chosen[s.key]} onChange={(e) => setChosen({ ...chosen, [s.key]: e.currentTarget.checked })} />
                  <span>{s.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        {!any && <p class="note" role="status">{p.nothingChosen}</p>}
        <p class="actions">
          <button type="button" class="primary" disabled={!any} onClick={() => setWarning(true)}>{p.printButton}</button>
        </p>
        <p class="note">{p.fileHint} <a href="#/save">{p.fileLink}</a></p>
        <p class="note">{p.previewHint}</p>
      </div>
      <div class="print-pages">
        {chosen.resentments && <ResentmentForm doc={doc} />}
        {chosen.fears && <FearForm doc={doc} />}
        {chosen.harms && <HarmForm doc={doc} />}
        {chosen.checklist && <ChecklistForm doc={doc} />}
        {chosen.pledge && <PledgeForm doc={doc} />}
      </div>
      <PrintWarning open={warning} onCancel={() => setWarning(false)} onContinue={printNow} />
    </>
  );
}
