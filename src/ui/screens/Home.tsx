import type { InventoryDoc } from '../../core/doc';
import { blanks, type InventoryId } from '../../core/flow';
import { routeHash } from '../router';
import { stepLabel } from '../stepCopy';
import { INVENTORY_BLURBS, INVENTORY_TITLES, progressLabel } from '../stepInfo';
import { saveCopy } from '../../content/copy';
import { fileState } from '../SaveStatus';
import { useApp } from '../store';
import { OpenFile } from './Save';

const INVENTORIES: InventoryId[] = ['resentments', 'fears', 'harms'];

function StillBlank({ doc, inventory }: { doc: InventoryDoc; inventory: InventoryId }) {
  const open = blanks(doc, inventory);
  if (open.length === 0) return null;
  return (
    <details>
      <summary>{open.length === 1 ? '1 step still blank' : `${open.length} steps still blank`}</summary>
      <ul class="plain links">
        {open.map((s) => (
          <li key={s.key}>
            <a href={routeHash({ name: 'step', inventory, key: s.key })}>{stepLabel(doc, s)}</a>
          </li>
        ))}
      </ul>
    </details>
  );
}

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
          {saveCopy.home[fileState(state)]} <a href="#/save">{saveCopy.home.link}</a>.
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
            <StillBlank doc={doc} inventory={inv} />
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
        <a href="#/save">Save</a> · <a href="#/print">Print or download</a> · <a href="#/settings">Settings</a>
      </p>
      <OpenFile />
    </>
  );
}
