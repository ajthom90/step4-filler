import type { InventoryDoc } from '../../core/doc';
import type { Step } from '../../core/flow';
import type { StepCopy } from '../stepCopy';

export type Update = (fn: (d: InventoryDoc) => InventoryDoc) => void;

export interface StepProps {
  doc: InventoryDoc;
  step: Step;
  copy: StepCopy;
  update: Update;
}
