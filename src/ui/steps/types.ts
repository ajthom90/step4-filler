import type { InventoryDoc } from '../../core/doc';
import type { Step } from '../../core/flow';
import type { StepCopy } from '../stepCopy';

export type Update = (fn: (d: InventoryDoc) => InventoryDoc) => void;

/**
 * Held by the runner. A step with an entry still being typed (not yet added) sets this to a
 * function that adds it, so Next never drops it.
 */
export interface DraftCommit { current: ((d: InventoryDoc) => InventoryDoc) | null }

export interface StepProps {
  doc: InventoryDoc;
  step: Step;
  copy: StepCopy;
  update: Update;
  draft: DraftCommit;
}
