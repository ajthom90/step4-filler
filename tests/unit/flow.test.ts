import { describe, expect, it } from 'vitest';
import { emptyDoc, type InventoryDoc, type Affects } from '../../src/core/doc';
import { blanks, isBlank, nextStep, progress, stepAfter, stepBefore, stepsFor } from '../../src/core/flow';
import { addEntry, markVisited } from '../../src/core/edit';

const god = { kind: 'god' as const, custom: '' };
const noAffects = (): Affects => ({ selfEsteem: false, security: false, ambitions: false, personalRelations: false, sexRelations: false, fear: false });
const res = (id: string, causeIds: string[]) => ({
  id, name: id, prayerDone: false, selfish: '', dishonest: '', selfSeeking: '', frightened: '',
  causes: causeIds.map((c) => ({ id: c, text: c, affects: noAffects() })),
});
const fear = (id: string) => ({ id, fear: id, why: '', trust: null, selfRelianceWorked: null, prayerDone: false, beWhat: '' });
const harm = (id: string) => ({ id, who: id, selfish: '', dishonest: '', inconsiderate: '', jealousy: false, suspicion: false, bitterness: false, fault: '', wasSelfish: null, sexPrayerDone: false, sexMeditationDone: false });
const keys = (doc: InventoryDoc, inv: 'resentments' | 'fears' | 'harms') => stepsFor(doc, inv).map((s) => s.key);
const visitAll = (doc: InventoryDoc, inv: 'resentments' | 'fears' | 'harms') =>
  stepsFor(doc, inv).reduce((d, s) => markVisited(d, s.key), doc);

describe('step order', () => {
  it('resentment order', () => {
    const doc = { ...emptyDoc('alcohol', god), resentments: [res('A', ['c1', 'c2']), res('B', ['c3'])] };
    const d = ['selfish', 'dishonest', 'selfSeeking', 'frightened'];
    expect(keys(doc, 'resentments')).toEqual([
      'res:intro', 'res:list', 'res:causes:A', 'res:causes:B',
      'res:affects:A:c1', 'res:affects:A:c2', 'res:affects:B:c3',
      'res:study', 'res:prayer:A', 'res:prayer:B',
      ...d.map((f) => `res:defect:A:${f}`), ...d.map((f) => `res:defect:B:${f}`),
    ]);
  });

  it('has a list step even with no entries', () => {
    expect(keys(emptyDoc('alcohol', god), 'resentments')).toEqual(['res:intro', 'res:list', 'res:study']);
  });

  it('fear order', () => {
    const doc = { ...emptyDoc('alcohol', god), fears: [fear('F'), fear('G')] };
    expect(keys(doc, 'fears')).toEqual([
      'fear:intro', 'fear:list', 'fear:why:F', 'fear:why:G', 'fear:trust:F', 'fear:trust:G',
      'fear:worked:F', 'fear:worked:G', 'fear:prayer:F', 'fear:prayer:G', 'fear:be:F', 'fear:be:G',
    ]);
  });

  it('harm order', () => {
    const doc = { ...emptyDoc('alcohol', god), harms: [harm('H'), harm('J')] };
    const w = ['selfish', 'dishonest', 'inconsiderate'];
    expect(keys(doc, 'harms')).toEqual([
      'harm:intro', 'harm:list',
      ...w.map((f) => `harm:where:H:${f}`), ...w.map((f) => `harm:where:J:${f}`),
      'harm:arouse:H', 'harm:arouse:J', 'harm:fault:H', 'harm:fault:J',
      'harm:relation:H', 'harm:relation:J', 'harm:sexPrayer:H', 'harm:sexPrayer:J',
      'harm:meditation:H', 'harm:meditation:J',
    ]);
  });

  it('steps carry inventory, entry, cause and field', () => {
    const doc = { ...emptyDoc('alcohol', god), resentments: [res('A', ['c1'])] };
    const s = stepsFor(doc, 'resentments');
    expect(s.find((x) => x.key === 'res:affects:A:c1')).toMatchObject({ inventory: 'resentments', kind: 'ticks', entryId: 'A', causeId: 'c1' });
    expect(s.find((x) => x.key === 'res:defect:A:selfSeeking')).toMatchObject({ kind: 'text', field: 'selfSeeking' });
  });
});

describe('guided movement', () => {
  it('late entry is led through what it missed', () => {
    let doc: InventoryDoc = { ...emptyDoc('alcohol', god), resentments: [res('A', ['c1'])] };
    doc = visitAll(doc, 'resentments');
    expect(nextStep(doc, 'resentments')).toBeNull();
    doc = addEntry(doc, 'resentments', 'New');
    const id = doc.resentments[1].id;
    expect(nextStep(doc, 'resentments')?.key).toBe(`res:causes:${id}`);
    doc = markVisited(doc, `res:causes:${id}`);
    expect(nextStep(doc, 'resentments')?.key).toBe(`res:prayer:${id}`);
  });

  it('can move past blanks', () => {
    const doc = { ...emptyDoc('alcohol', god), fears: [fear('F')] };
    expect(stepAfter(doc, 'fears', 'fear:why:F')?.key).toBe('fear:trust:F');
    expect(stepBefore(doc, 'fears', 'fear:trust:F')?.key).toBe('fear:why:F');
    expect(stepBefore(doc, 'fears', 'fear:intro')).toBeNull();
    expect(stepAfter(doc, 'fears', 'fear:be:F')).toBeNull();
    const visited = markVisited(doc, 'fear:why:F');
    expect(blanks(visited, 'fears').map((s) => s.key)).toEqual(['fear:why:F']);
  });

  it('blank rules', () => {
    let doc: InventoryDoc = { ...emptyDoc('alcohol', god), harms: [harm('H')], resentments: [res('A', [])], fears: [fear('F')] };
    const find = (inv: 'resentments' | 'fears' | 'harms', key: string) => stepsFor(doc, inv).find((s) => s.key === key)!;
    expect(isBlank(doc, find('harms', 'harm:arouse:H'))).toBe(false);
    expect(isBlank(doc, find('fears', 'fear:trust:F'))).toBe(true);
    expect(isBlank(doc, find('fears', 'fear:why:F'))).toBe(true);
    expect(isBlank(doc, find('resentments', 'res:causes:A'))).toBe(true);
    expect(isBlank(doc, find('fears', 'fear:intro'))).toBe(false);
    doc = { ...doc, fears: [{ ...fear('F'), why: '  ' }] };
    expect(isBlank(doc, find('fears', 'fear:why:F'))).toBe(true);
    doc = { ...doc, fears: [{ ...fear('F'), why: 'x', trust: 'god' }] };
    expect(isBlank(doc, find('fears', 'fear:why:F'))).toBe(false);
    expect(isBlank(doc, find('fears', 'fear:trust:F'))).toBe(false);
  });

  it('an unticked ticks step is not blank once visited, and prayers are never blank', () => {
    let doc: InventoryDoc = { ...emptyDoc('alcohol', god), resentments: [res('A', ['c1'])] };
    doc = visitAll(doc, 'resentments');
    const bk = blanks(doc, 'resentments').map((s) => s.key);
    expect(bk).not.toContain('res:affects:A:c1');
    expect(bk).not.toContain('res:prayer:A');
    expect(bk).toContain('res:defect:A:selfish');
  });

  it('progress goes not-started, in-progress, done, including with blanks', () => {
    let doc: InventoryDoc = { ...emptyDoc('alcohol', god), fears: [fear('F')] };
    expect(progress(doc, 'fears')).toMatchObject({ status: 'not-started', visited: 0 });
    doc = markVisited(doc, 'fear:intro');
    const p = progress(doc, 'fears');
    expect(p.status).toBe('in-progress');
    expect(p.visited).toBe(1);
    expect(p.total).toBe(stepsFor(doc, 'fears').length);
    expect(p.column).toBe(1);
    doc = visitAll(doc, 'fears');
    expect(progress(doc, 'fears')).toMatchObject({ status: 'done', visited: p.total, total: p.total });
  });
});
