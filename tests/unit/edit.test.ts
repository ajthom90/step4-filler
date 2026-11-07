import { describe, expect, it } from 'vitest';
import { emptyDoc, type InventoryDoc } from '../../src/core/doc';
import { nextStep, stepsFor } from '../../src/core/flow';
import { addCause, addEntry, editCause, markVisited, removeCause, removeEntry, renameEntry, setField } from '../../src/core/edit';

const god = { kind: 'god' as const, custom: '' };
const visitAll = (doc: InventoryDoc, inv: 'resentments' | 'fears' | 'harms') =>
  stepsFor(doc, inv).reduce((d, s) => markVisited(d, s.key), doc);
const step = (doc: InventoryDoc, inv: 'resentments' | 'fears' | 'harms', key: string) => stepsFor(doc, inv).find((s) => s.key === key)!;

function twoPeople() {
  let doc = emptyDoc('alcohol', god);
  doc = addEntry(doc, 'resentments', 'Ann');
  doc = addEntry(doc, 'resentments', 'Bob');
  const [a, b] = doc.resentments.map((r) => r.id);
  doc = addCause(doc, a, 'a1');
  doc = addCause(doc, a, 'a2');
  doc = addCause(doc, b, 'b1');
  return { doc: visitAll(doc, 'resentments'), a, b };
}

describe('removal', () => {
  it("removing an entry prunes its visited keys, leaving other entries' keys", () => {
    const { doc, a, b } = twoPeople();
    const out = removeEntry(doc, 'resentments', a);
    expect(Object.keys(out.visited).some((k) => k.split(':').includes(a))).toBe(false);
    expect(Object.keys(out.visited).some((k) => k.split(':').includes(b))).toBe(true);
    expect(stepsFor(out, 'resentments').some((s) => s.entryId === a)).toBe(false);
    expect(nextStep(out, 'resentments')).toBeNull();
    expect(out.resentments.map((r) => r.id)).toEqual([b]);
  });

  it('after deleting a mid-flow entry, resume lands on a valid step', () => {
    let { doc, a } = twoPeople();
    doc = addEntry(doc, 'resentments', 'Cy');
    const out = removeEntry(doc, 'resentments', a);
    const n = nextStep(out, 'resentments')!;
    expect(stepsFor(out, 'resentments').map((s) => s.key)).toContain(n.key);
    expect(n.entryId).toBe(out.resentments[1].id);
  });

  it('removeCause prunes that cause only', () => {
    const { doc, a } = twoPeople();
    const cid = doc.resentments[0].causes[0].id;
    const keep = doc.resentments[0].causes[1].id;
    const out = removeCause(doc, a, cid);
    expect(Object.keys(out.visited).some((k) => k.split(':').includes(cid))).toBe(false);
    expect(out.visited[`res:affects:${a}:${keep}`]).toBe(true);
    expect(out.visited[`res:causes:${a}`]).toBe(true);
    expect(stepsFor(out, 'resentments').some((s) => s.causeId === cid)).toBe(false);
    expect(nextStep(out, 'resentments')).toBeNull();
  });

  it('removes fear and harm entries too', () => {
    let doc = addEntry(addEntry(emptyDoc('alcohol', god), 'fears', 'F'), 'harms', 'H');
    doc = visitAll(visitAll(doc, 'fears'), 'harms');
    const f = doc.fears[0].id;
    const h = doc.harms[0].id;
    doc = removeEntry(removeEntry(doc, 'fears', f), 'harms', h);
    expect(doc.fears).toEqual([]);
    expect(doc.harms).toEqual([]);
    expect(Object.keys(doc.visited).some((k) => k.includes(f) || k.includes(h))).toBe(false);
  });
});

describe('purity', () => {
  it('edits are pure', () => {
    const { doc, a } = twoPeople();
    const snap = JSON.stringify(doc);
    const cid = doc.resentments[0].causes[0].id;
    markVisited(doc, 'x');
    addEntry(doc, 'fears', 'f');
    addCause(doc, a, 'z');
    removeCause(doc, a, cid);
    removeEntry(doc, 'resentments', a);
    setField(doc, step(doc, 'resentments', `res:defect:${a}:selfish`), 'hi');
    expect(JSON.stringify(doc)).toBe(snap);
  });
});

describe('setField', () => {
  it('writes the right place for each kind', () => {
    let doc = emptyDoc('alcohol', god);
    doc = addEntry(doc, 'resentments', 'Ann');
    doc = addEntry(doc, 'fears', 'F');
    doc = addEntry(doc, 'harms', 'H');
    const r = doc.resentments[0].id;
    doc = addCause(doc, r, 'c');
    const c = doc.resentments[0].causes[0].id;
    const f = doc.fears[0].id;
    const h = doc.harms[0].id;

    doc = setField(doc, step(doc, 'resentments', `res:defect:${r}:frightened`), 'scared');
    expect(doc.resentments[0].frightened).toBe('scared');
    doc = setField(doc, step(doc, 'resentments', `res:prayer:${r}`), true);
    expect(doc.resentments[0].prayerDone).toBe(true);
    doc = setField(doc, { ...step(doc, 'resentments', `res:affects:${r}:${c}`), field: 'security' }, true);
    expect(doc.resentments[0].causes[0].affects.security).toBe(true);
    expect(doc.resentments[0].causes[0].affects.fear).toBe(false);
    doc = setField(doc, step(doc, 'fears', `fear:why:${f}`), 'because');
    expect(doc.fears[0].why).toBe('because');
    doc = setField(doc, step(doc, 'fears', `fear:trust:${f}`), 'god');
    expect(doc.fears[0].trust).toBe('god');
    doc = setField(doc, step(doc, 'fears', `fear:worked:${f}`), 'no');
    expect(doc.fears[0].selfRelianceWorked).toBe('no');
    doc = setField(doc, step(doc, 'harms', `harm:where:${h}:dishonest`), 'lied');
    expect(doc.harms[0].dishonest).toBe('lied');
    doc = setField(doc, { ...step(doc, 'harms', `harm:arouse:${h}`), field: 'bitterness' }, true);
    expect(doc.harms[0].bitterness).toBe(true);
    doc = setField(doc, step(doc, 'harms', `harm:relation:${h}`), 'yes');
    expect(doc.harms[0].wasSelfish).toBe('yes');
    doc = setField(doc, step(doc, 'harms', `harm:meditation:${h}`), true);
    expect(doc.harms[0].sexMeditationDone).toBe(true);
    doc = setField(doc, step(doc, 'harms', `harm:sexPrayer:${h}`), true);
    expect(doc.harms[0].sexPrayerDone).toBe(true);
  });

  it('ignores a step whose entry no longer exists', () => {
    const { doc, a } = twoPeople();
    const s = step(doc, 'resentments', `res:defect:${a}:selfish`);
    const out = removeEntry(doc, 'resentments', a);
    expect(setField(out, s, 'x')).toEqual(out);
  });
});

describe('renaming', () => {
  it('renameEntry changes only the name, keeping answers, causes and visited keys', () => {
    const { doc, a, b } = twoPeople();
    const withText = setField(doc, step(doc, 'resentments', `res:defect:${a}:selfish`), 'kept');
    const out = renameEntry(withText, 'resentments', a, 'Anne');
    expect(out.resentments[0]).toEqual({ ...withText.resentments[0], name: 'Anne' });
    expect(out.resentments[1]).toEqual(withText.resentments[1]);
    expect(out.visited).toEqual(withText.visited);
    expect(out.resentments.map((r) => r.id)).toEqual([a, b]);
  });
  it('renameEntry sets the right field for fears and harms, and ignores an unknown id', () => {
    let d = addEntry(addEntry(emptyDoc('alcohol', god), 'fears', 'dark'), 'harms', 'Cy');
    d = renameEntry(renameEntry(d, 'fears', d.fears[0].id, 'heights'), 'harms', d.harms[0].id, 'Cyrus');
    expect(d.fears[0].fear).toBe('heights');
    expect(d.harms[0].who).toBe('Cyrus');
    expect(renameEntry(d, 'fears', 'nope', 'x')).toEqual(d);
  });
  it('editCause changes the text and keeps its ticks and visited keys', () => {
    const { doc, a } = twoPeople();
    const cause = doc.resentments[0].causes[0];
    const ticked = setField(doc, { ...step(doc, 'resentments', `res:affects:${a}:${cause.id}`), field: 'security' }, true);
    const out = editCause(ticked, a, cause.id, 'fixed');
    expect(out.resentments[0].causes[0]).toEqual({ ...ticked.resentments[0].causes[0], text: 'fixed' });
    expect(out.visited).toEqual(ticked.visited);
  });
});
