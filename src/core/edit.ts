import { newId, type Affects, type InventoryDoc, type YesNo } from './doc';
import type { InventoryId, Step } from './flow';

const KEY_PREFIX: Record<InventoryId, string> = { resentments: 'res', fears: 'fear', harms: 'harm' };

/** Drops visited keys that name `id` in any id position (after the prefix and step name). */
function pruneVisited(visited: InventoryDoc['visited'], id: string): InventoryDoc['visited'] {
  const out: InventoryDoc['visited'] = {};
  for (const k of Object.keys(visited)) {
    if (!k.split(':').slice(2).includes(id)) out[k] = true;
  }
  return out;
}

export function markVisited(doc: InventoryDoc, key: string): InventoryDoc {
  if (doc.visited[key]) return doc;
  return { ...doc, visited: { ...doc.visited, [key]: true } };
}

export function addEntry(doc: InventoryDoc, inv: InventoryId, name: string): InventoryDoc {
  const id = newId();
  if (inv === 'resentments') {
    return { ...doc, resentments: [...doc.resentments, { id, name, causes: [], prayerDone: false, selfish: '', dishonest: '', selfSeeking: '', frightened: '' }] };
  }
  if (inv === 'fears') {
    return { ...doc, fears: [...doc.fears, { id, fear: name, why: '', trust: null, selfRelianceWorked: null, prayerDone: false, beWhat: '' }] };
  }
  return {
    ...doc,
    harms: [...doc.harms, { id, who: name, selfish: '', dishonest: '', inconsiderate: '', jealousy: false, suspicion: false, bitterness: false, fault: '', wasSelfish: null, sexPrayerDone: false, sexMeditationDone: false }],
  };
}

export function removeEntry(doc: InventoryDoc, inv: InventoryId, entryId: string): InventoryDoc {
  const prefix = KEY_PREFIX[inv];
  const visited: InventoryDoc['visited'] = {};
  for (const k of Object.keys(doc.visited)) {
    const parts = k.split(':');
    if (!(parts[0] === prefix && parts.slice(2).includes(entryId))) visited[k] = true;
  }
  return { ...doc, [inv]: doc[inv].filter((e) => e.id !== entryId), visited };
}

export function addCause(doc: InventoryDoc, entryId: string, text: string): InventoryDoc {
  const affects: Affects = { selfEsteem: false, security: false, ambitions: false, personalRelations: false, sexRelations: false, fear: false };
  return {
    ...doc,
    resentments: doc.resentments.map((r) => (r.id === entryId ? { ...r, causes: [...r.causes, { id: newId(), text, affects }] } : r)),
  };
}

export function removeCause(doc: InventoryDoc, entryId: string, causeId: string): InventoryDoc {
  return {
    ...doc,
    resentments: doc.resentments.map((r) => (r.id === entryId ? { ...r, causes: r.causes.filter((c) => c.id !== causeId) } : r)),
    visited: pruneVisited(doc.visited, causeId),
  };
}

/**
 * Writes `value` where `step` points. A `ticks` step covers several fields, so the
 * caller passes a copy of the step with `field` set to the one tick being changed.
 * A step whose entry or cause no longer exists leaves the doc unchanged.
 */
export function setField(doc: InventoryDoc, step: Step, value: string | boolean | YesNo): InventoryDoc {
  const field = step.field;
  if (!field || !step.entryId) return doc;
  const patch = <T extends { id: string }>(list: T[], f: (e: T) => T): T[] => list.map((e) => (e.id === step.entryId ? f(e) : e));
  if (step.inventory === 'resentments') {
    if (step.kind === 'ticks') {
      if (!step.causeId) return doc;
      return {
        ...doc,
        resentments: patch(doc.resentments, (r) => ({
          ...r,
          causes: r.causes.map((c) => (c.id === step.causeId ? { ...c, affects: { ...c.affects, [field]: value } } : c)),
        })),
      };
    }
    return { ...doc, resentments: patch(doc.resentments, (r) => ({ ...r, [field]: value })) };
  }
  return { ...doc, [step.inventory]: patch(doc[step.inventory] as Array<{ id: string }>, (e) => ({ ...e, [field]: value })) } as InventoryDoc;
}
