import type { FunctionComponent } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { InventoryDoc } from '../../core/doc';
import { markVisited } from '../../core/edit';
import { blanks, isBlank, nextStep, progress, stepAfter, stepBefore, stepsFor, type InventoryId, type Step } from '../../core/flow';
import { CausesStep } from '../steps/CausesStep';
import { ChoiceStep } from '../steps/ChoiceStep';
import { IntroStep } from '../steps/IntroStep';
import { ListStep } from '../steps/ListStep';
import { PrayerStep } from '../steps/PrayerStep';
import { TextStep } from '../steps/TextStep';
import { TicksStep } from '../steps/TicksStep';
import type { DraftCommit, StepProps } from '../steps/types';
import { routeHash } from '../router';
import { entryName, stepCopy, stepLabel } from '../stepCopy';
import { useApp } from '../store';

const BODIES: Record<Step['kind'], FunctionComponent<StepProps>> = {
  intro: IntroStep,
  list: ListStep,
  causes: CausesStep,
  text: TextStep,
  ticks: TicksStep,
  choice: ChoiceStep,
  prayer: PrayerStep,
};

const FINISHED_NOUN: Record<InventoryId, string> = { resentments: 'resentment', fears: 'fear', harms: 'sex conduct and harms' };

const stepRoute = (inventory: InventoryId, key?: string) => ({ name: 'step' as const, inventory, key });

/**
 * Where Next goes. Moving on from a step for the first time, or from the list (where names
 * may have been added), goes to the first step further on that has not been passed, so a
 * name added late is led through its columns and the earlier unfinished work comes back
 * after. Moving on from a step already passed while reviewing goes to the very next one.
 */
function destination(doc: InventoryDoc, step: Step, forward: boolean): Step | null {
  if (!forward) return stepAfter(doc, step.inventory, step.key);
  const steps = stepsFor(doc, step.inventory);
  const i = steps.findIndex((s) => s.key === step.key);
  return steps.slice(i + 1).find((s) => !doc.visited[s.key]) ?? nextStep(doc, step.inventory);
}

function Finished({ inventory }: { inventory: InventoryId }) {
  const { state } = useApp();
  const doc = state.doc!;
  const open = blanks(doc, inventory);
  return (
    <>
      <h1 tabIndex={-1} id="step-question">You've been through every {FINISHED_NOUN[inventory]} step</h1>
      {open.length === 0 ? (
        <p>Nothing is blank.</p>
      ) : (
        <>
          <p>These are still blank. Open one to fill it in, or leave it as it is.</p>
          <ul class="plain links">
            {open.map((s) => (
              <li key={s.key}>
                <a href={routeHash(stepRoute(inventory, s.key))}>{stepLabel(doc, s)}</a>
              </li>
            ))}
          </ul>
        </>
      )}
      <ul class="plain links">
        <li><a href={routeHash(stepRoute(inventory, stepsFor(doc, inventory).find((s) => s.kind === 'list')?.key))}>Add another name</a></li>
        <li><a href={routeHash(stepRoute(inventory, stepsFor(doc, inventory)[0].key))}>Go through it from the start</a></li>
        <li><a href="#/home">Back to your inventory</a></li>
      </ul>
    </>
  );
}

export function StepRunner({ inventory, stepKey }: { inventory: InventoryId; stepKey?: string }) {
  const { state, update, go } = useApp();
  const doc = state.doc!;
  const draft = useRef<DraftCommit['current']>(null);

  const requested = stepKey === undefined ? undefined : stepsFor(doc, inventory).find((s) => s.key === stepKey);
  const step = requested ?? nextStep(doc, inventory) ?? undefined;
  const wanted = step ? routeHash(stepRoute(inventory, step.key)) : routeHash(stepRoute(inventory));

  // Keep the address on the step shown, so a reload or a bookmark returns to it.
  useEffect(() => {
    if (!requested && window.location.hash !== wanted) window.location.replace(wanted);
  }, [requested, wanted]);

  // A step already passed when it was opened is being reviewed, not worked through.
  const firstSeen = useRef<{ key: string; fresh: boolean } | null>(null);
  if (step && firstSeen.current?.key !== step.key) firstSeen.current = { key: step.key, fresh: !doc.visited[step.key] };

  if (!step) return <Finished inventory={inventory} />;

  const copy = stepCopy(doc, step);
  const Body = BODIES[step.kind];
  const who = entryName(doc, step);
  // The causes and prayer questions already name the person.
  const showWho = who !== undefined && step.kind !== 'causes' && step.kind !== 'prayer';
  const p = progress(doc, inventory);
  const before = stepBefore(doc, inventory, step.key);

  const next = () => {
    const finish = (d: InventoryDoc) => markVisited(draft.current ? draft.current(d) : d, step.key);
    const after = finish(doc);
    const forward = step.kind === 'list' || (firstSeen.current?.fresh ?? false);
    const to = destination(after, step, forward);
    update(finish);
    go(stepRoute(inventory, to?.key));
  };
  const skipping = (step.kind === 'text' || step.kind === 'choice') && isBlank(doc, step);
  const nextLabel = step.kind === 'list' ? "That's everyone for now" : skipping ? 'Skip for now' : 'Next';

  return (
    <>
      <p class="eyebrow" data-testid="eyebrow">{copy.eyebrow}</p>
      <progress class="bar" max={p.total} value={p.visited} aria-label="Progress through this inventory" />
      {showWho && <p class="who" data-testid="who">{who}</p>}
      <h1 tabIndex={-1} id="step-question">{copy.question}</h1>
      {step.kind !== 'intro' && <p class="hint">{copy.hint}</p>}
      <Body key={step.key} doc={doc} step={step} copy={copy} update={update} draft={draft} />
      {step.kind !== 'list' && step.kind !== 'intro' && (
        <p class="side">
          <a href={routeHash(stepRoute(inventory, stepsFor(doc, inventory).find((s) => s.kind === 'list')?.key))}>Add another name</a>
        </p>
      )}
      <div class="stepnav">
        <button type="button" onClick={() => (before ? go(stepRoute(inventory, before.key)) : go({ name: 'home' }))}>Back</button>
        <button type="button" class="primary" onClick={next}>{nextLabel}</button>
      </div>
    </>
  );
}
