import type { InventoryDoc } from './doc';

export type InventoryId = 'resentments' | 'fears' | 'harms';
export type StepKind = 'intro' | 'list' | 'causes' | 'text' | 'ticks' | 'choice' | 'prayer';
export interface Step {
  key: string;
  inventory: InventoryId;
  column: number;
  kind: StepKind;
  entryId?: string;
  causeId?: string;
  /** The doc field a `text`, `choice` or `prayer` step edits. A `ticks` step covers several fields, so callers pick one. */
  field?: string;
}

export const RESENTMENT_DEFECTS = ['selfish', 'dishonest', 'selfSeeking', 'frightened'] as const;
export const HARM_WHERE = ['selfish', 'dishonest', 'inconsiderate'] as const;

/** Columns per inventory, not counting the intro (column 0). */
const TOTAL_COLUMNS: Record<InventoryId, number> = { resentments: 4, fears: 6, harms: 7 };

function resentmentSteps(doc: InventoryDoc): Step[] {
  const inventory = 'resentments';
  const out: Step[] = [
    { key: 'res:intro', inventory, column: 0, kind: 'intro' },
    { key: 'res:list', inventory, column: 1, kind: 'list' },
  ];
  for (const r of doc.resentments) {
    out.push({ key: `res:causes:${r.id}`, inventory, column: 2, kind: 'causes', entryId: r.id });
  }
  for (const r of doc.resentments) {
    for (const c of r.causes) {
      out.push({ key: `res:affects:${r.id}:${c.id}`, inventory, column: 3, kind: 'ticks', entryId: r.id, causeId: c.id });
    }
  }
  out.push({ key: 'res:study', inventory, column: 4, kind: 'intro' });
  for (const r of doc.resentments) {
    out.push({ key: `res:prayer:${r.id}`, inventory, column: 4, kind: 'prayer', entryId: r.id, field: 'prayerDone' });
  }
  for (const r of doc.resentments) {
    for (const f of RESENTMENT_DEFECTS) {
      out.push({ key: `res:defect:${r.id}:${f}`, inventory, column: 4, kind: 'text', entryId: r.id, field: f });
    }
  }
  return out;
}

function fearSteps(doc: InventoryDoc): Step[] {
  const inventory = 'fears';
  const out: Step[] = [
    { key: 'fear:intro', inventory, column: 0, kind: 'intro' },
    { key: 'fear:list', inventory, column: 1, kind: 'list' },
  ];
  const each = (prefix: string, column: number, kind: StepKind, field: string) => {
    for (const f of doc.fears) out.push({ key: `fear:${prefix}:${f.id}`, inventory, column, kind, entryId: f.id, field });
  };
  each('why', 2, 'text', 'why');
  each('trust', 3, 'choice', 'trust');
  each('worked', 4, 'choice', 'selfRelianceWorked');
  each('prayer', 5, 'prayer', 'prayerDone');
  each('be', 6, 'text', 'beWhat');
  return out;
}

function harmSteps(doc: InventoryDoc): Step[] {
  const inventory = 'harms';
  const out: Step[] = [
    { key: 'harm:intro', inventory, column: 0, kind: 'intro' },
    { key: 'harm:list', inventory, column: 1, kind: 'list' },
  ];
  for (const h of doc.harms) {
    for (const f of HARM_WHERE) {
      out.push({ key: `harm:where:${h.id}:${f}`, inventory, column: 2, kind: 'text', entryId: h.id, field: f });
    }
  }
  const each = (prefix: string, column: number, kind: StepKind, field?: string) => {
    for (const h of doc.harms) {
      out.push({ key: `harm:${prefix}:${h.id}`, inventory, column, kind, entryId: h.id, ...(field ? { field } : {}) });
    }
  };
  each('arouse', 3, 'ticks');
  each('fault', 4, 'text', 'fault');
  each('relation', 5, 'choice', 'wasSelfish');
  each('sexPrayer', 6, 'prayer', 'sexPrayerDone');
  each('meditation', 7, 'prayer', 'sexMeditationDone');
  return out;
}

export function stepsFor(doc: InventoryDoc, inv: InventoryId): Step[] {
  if (inv === 'resentments') return resentmentSteps(doc);
  if (inv === 'fears') return fearSteps(doc);
  return harmSteps(doc);
}

/** First step not yet visited, or null when every step has been. */
export function nextStep(doc: InventoryDoc, inv: InventoryId): Step | null {
  return stepsFor(doc, inv).find((s) => !doc.visited[s.key]) ?? null;
}

export function stepAfter(doc: InventoryDoc, inv: InventoryId, key: string): Step | null {
  const steps = stepsFor(doc, inv);
  const i = steps.findIndex((s) => s.key === key);
  return i >= 0 ? (steps[i + 1] ?? null) : null;
}

export function stepBefore(doc: InventoryDoc, inv: InventoryId, key: string): Step | null {
  const steps = stepsFor(doc, inv);
  const i = steps.findIndex((s) => s.key === key);
  return i > 0 ? steps[i - 1] : null;
}

/** Whether the step has no answer. Ticks, prayers and intros are never blank: an unticked box is an answer. */
export function isBlank(doc: InventoryDoc, step: Step): boolean {
  switch (step.kind) {
    case 'list':
      return doc[step.inventory].length === 0;
    case 'causes':
      return (doc.resentments.find((r) => r.id === step.entryId)?.causes.length ?? 0) === 0;
    case 'text': {
      const entry = (doc[step.inventory] as unknown as Array<Record<string, unknown>>).find((e) => e.id === step.entryId);
      const v = entry?.[step.field ?? ''];
      return typeof v !== 'string' || v.trim() === '';
    }
    case 'choice': {
      const entry = (doc[step.inventory] as unknown as Array<Record<string, unknown>>).find((e) => e.id === step.entryId);
      return (entry?.[step.field ?? ''] ?? null) === null;
    }
    default:
      return false;
  }
}

/** Steps the person has passed through that still have no answer. */
export function blanks(doc: InventoryDoc, inv: InventoryId): Step[] {
  return stepsFor(doc, inv).filter((s) => doc.visited[s.key] && isBlank(doc, s));
}

export function progress(doc: InventoryDoc, inv: InventoryId): {
  column: number; totalColumns: number; visited: number; total: number; status: 'not-started' | 'in-progress' | 'done';
} {
  const steps = stepsFor(doc, inv);
  const visited = steps.filter((s) => doc.visited[s.key]).length;
  const next = steps.find((s) => !doc.visited[s.key]);
  const totalColumns = TOTAL_COLUMNS[inv];
  return {
    column: next ? next.column : totalColumns,
    totalColumns,
    visited,
    total: steps.length,
    status: visited === 0 ? 'not-started' : next ? 'in-progress' : 'done',
  };
}
