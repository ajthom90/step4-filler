import type { InventoryId } from '../../core/flow';
import { INVENTORY_BLURBS, INVENTORY_TITLES, progressLabel } from '../stepInfo';
import { useApp } from '../store';

const INVENTORIES: InventoryId[] = ['resentments', 'fears', 'harms'];

export function Home() {
  const { state } = useApp();
  const doc = state.doc!;
  const checklistCount = doc.checklist.selected.length;
  const pledgeStarted = doc.pledge.listA.length + doc.pledge.listB.length > 0;
  return (
    <>
      <h1 tabIndex={-1}>Your inventory</h1>
      {state.mode.kind === 'none' && (
        <p class="notice">
          Not saved yet. Your work is only in this open page. <a href="#/save">Choose how to save it</a>.
        </p>
      )}
      <ul class="plain sections">
        {INVENTORIES.map((inv) => (
          <li key={inv} class="section">
            <h2>
              <a href={`#/step/${inv}`}>{INVENTORY_TITLES[inv]}</a>
            </h2>
            <p class="progress">{progressLabel(doc, inv)}</p>
            <p>{INVENTORY_BLURBS[inv]}</p>
          </li>
        ))}
        <li class="section">
          <h2>
            <a href="#/checklist">Flaws and assets checklist</a>
          </h2>
          <p class="progress">{checklistCount > 0 ? `${checklistCount} selected` : 'Not started'}</p>
          <p>A list to look through for patterns you recognize.</p>
        </li>
        <li class="section">
          <h2>
            <a href="#/pledge">Abstinence pledge</a> <span class="optional">(optional)</span>
          </h2>
          <p class="progress">{pledgeStarted ? 'Started' : 'Not started'}</p>
          <p>Write down what you are abstaining from, if that is part of your program.</p>
        </li>
      </ul>
      <p>
        <a href="#/print">Print or download</a> · <a href="#/settings">Settings</a>
      </p>
    </>
  );
}
