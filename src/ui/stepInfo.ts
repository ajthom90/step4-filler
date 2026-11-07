import type { InventoryDoc } from '../core/doc';
import { progress, type InventoryId } from '../core/flow';

/** A stand-in for the step wording that Task 8 provides. */
export const INVENTORY_TITLES: Record<InventoryId, string> = {
  resentments: 'Resentments',
  fears: 'Fears',
  harms: 'Sex conduct and harms',
};

export const INVENTORY_BLURBS: Record<InventoryId, string> = {
  resentments: 'Who or what you are angry at, and why.',
  fears: 'What you are afraid of, and why.',
  harms: 'Where your conduct in relationships caused harm.',
};

export function progressLabel(doc: InventoryDoc, inv: InventoryId): string {
  const p = progress(doc, inv);
  if (p.status === 'done') return 'Finished';
  if (p.status === 'not-started' || p.column < 1) return 'Not started';
  return `Column ${p.column} of ${p.totalColumns}`;
}
