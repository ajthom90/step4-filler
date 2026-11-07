import { describe, expect, it } from 'vitest';
import { emptyDoc, newId, type InventoryDoc } from '../../src/core/doc';
import { FileError, validateDoc } from '../../src/core/validate';

const god = { kind: 'god', custom: '' } as const;
const allAffects = { selfEsteem: true, security: false, ambitions: true, personalRelations: false, sexRelations: true, fear: false };

function fullDoc(): InventoryDoc {
  const doc = emptyDoc('alcohol', { kind: 'custom', custom: 'Source' });
  doc.visited = { 'resentments:a': true, intro: true };
  doc.resentments = [{
    id: 'r1', name: 'Name {god}', prayerDone: true, selfish: 's', dishonest: 'd', selfSeeking: 'ss', frightened: 'f',
    causes: [{ id: 'c1', text: '<img onerror=x>', affects: allAffects }],
  }];
  doc.fears = [{ id: 'f1', fear: 'x', why: 'y', trust: 'god', selfRelianceWorked: 'no', prayerDone: true, beWhat: 'z' }];
  doc.harms = [{
    id: 'h1', who: 'w', selfish: 'a', dishonest: 'b', inconsiderate: 'c', jealousy: true, suspicion: false, bitterness: true,
    fault: 'f', wasSelfish: 'yes', sexPrayerDone: true, sexMeditationDone: false,
  }];
  doc.checklist = { selected: ['one', 'two'], other: 'o' };
  doc.pledge = { listA: ['a'], listB: ['b'], name: 'n', date: '2026-01-01' };
  return doc;
}

function code(fn: () => unknown): string {
  try { fn(); } catch (e) { if (e instanceof FileError) return e.code; throw e; }
  return 'none';
}

describe('validateDoc', () => {
  it('accepts an empty doc and a fully populated doc unchanged', () => {
    const empty = emptyDoc('food', god);
    expect(validateDoc(JSON.parse(JSON.stringify(empty)))).toEqual(empty);
    const full = fullDoc();
    expect(validateDoc(JSON.parse(JSON.stringify(full)))).toEqual(full);
  });

  it('drops unknown fields', () => {
    const raw = JSON.parse(JSON.stringify(fullDoc()));
    raw.extra = 1;
    raw.settings.extra = 1;
    raw.resentments[0].extra = 1;
    raw.resentments[0].causes[0].affects.extra = true;
    raw.pledge.extra = 1;
    const out = validateDoc(raw) as unknown as Record<string, unknown>;
    expect(out).toEqual(fullDoc());
    expect('extra' in out).toBe(false);
  });

  it('does not carry __proto__', () => {
    const text = JSON.stringify(emptyDoc('food', god)).replace(
      '{"format"', '{"__proto__":{"x":1},"format"');
    const out = validateDoc(JSON.parse(text));
    expect((out as unknown as { x?: unknown }).x).toBeUndefined();
    expect(({} as { x?: unknown }).x).toBeUndefined();
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  });

  it('does not let visited keys reach a prototype', () => {
    const raw = JSON.parse(JSON.stringify(emptyDoc('food', god)));
    raw.visited = JSON.parse('{"__proto__":true,"ok":true}');
    const out = validateDoc(raw);
    expect(Object.getPrototypeOf(out.visited)).toBe(Object.prototype);
    expect(Object.keys(out.visited)).toEqual(['ok']);
  });

  it('ignores inherited fields', () => {
    const inherited = Object.create(emptyDoc('food', god));
    expect(code(() => validateDoc(inherited))).toBe('not-inventory');
  });

  it('rejects wrong types', () => {
    const mutate = (fn: (d: any) => void) => {
      const d = JSON.parse(JSON.stringify(fullDoc()));
      fn(d);
      return () => validateDoc(d);
    };
    expect(code(mutate((d) => { d.resentments[0].name = 5; }))).toBe('corrupt');
    expect(code(mutate((d) => { d.resentments[0].causes[0].affects.fear = 'yes'; }))).toBe('corrupt');
    expect(code(mutate((d) => { d.fears[0].trust = 'maybe'; }))).toBe('corrupt');
    expect(code(mutate((d) => { d.settings.preset = 'cats'; }))).toBe('corrupt');
    expect(code(mutate((d) => { d.settings.godWord.kind = 'x'; }))).toBe('corrupt');
    expect(code(mutate((d) => { d.harms[0].wasSelfish = 'maybe'; }))).toBe('corrupt');
    expect(code(mutate((d) => { d.visited.bad = false; }))).toBe('corrupt');
    expect(code(mutate((d) => { d.visited.bad = 'true'; }))).toBe('corrupt');
    expect(code(mutate((d) => { d.visited = []; }))).toBe('corrupt');
    expect(code(mutate((d) => { d.checklist.selected = 'a'; }))).toBe('corrupt');
    expect(code(mutate((d) => { d.checklist.selected = [1]; }))).toBe('corrupt');
    expect(code(mutate((d) => { d.checklist.other = null; }))).toBe('corrupt');
    expect(code(mutate((d) => { delete d.checklist; }))).toBe('corrupt');
    expect(code(mutate((d) => { d.pledge.listA = [null]; }))).toBe('corrupt');
    expect(code(mutate((d) => { d.pledge.date = 5; }))).toBe('corrupt');
    expect(code(mutate((d) => { d.pledge = null; }))).toBe('corrupt');
    expect(code(mutate((d) => { d.resentments = {}; }))).toBe('corrupt');
  });

  it('rejects non-inventory JSON', () => {
    expect(code(() => validateDoc({}))).toBe('not-inventory');
    expect(code(() => validateDoc([]))).toBe('not-inventory');
    expect(code(() => validateDoc(null))).toBe('not-inventory');
    expect(code(() => validateDoc({ format: 'other', version: 1 }))).toBe('not-inventory');
  });

  it('rejects newer versions', () => {
    const raw = JSON.parse(JSON.stringify(emptyDoc('food', god)));
    raw.version = 2;
    expect(code(() => validateDoc(raw))).toBe('newer-version');
  });

  it('rejects bad version numbers as corrupt', () => {
    const raw = JSON.parse(JSON.stringify(emptyDoc('food', god)));
    raw.version = 0;
    expect(code(() => validateDoc(raw))).toBe('corrupt');
  });

  it('rejects duplicate ids', () => {
    const d = JSON.parse(JSON.stringify(fullDoc()));
    d.resentments.push({ ...d.resentments[0] });
    expect(code(() => validateDoc(d))).toBe('corrupt');
    const e = JSON.parse(JSON.stringify(fullDoc()));
    e.resentments[0].causes.push({ ...e.resentments[0].causes[0] });
    expect(code(() => validateDoc(e))).toBe('corrupt');
    const f = JSON.parse(JSON.stringify(fullDoc()));
    f.fears.push({ ...f.fears[0] });
    expect(code(() => validateDoc(f))).toBe('corrupt');
  });
});

describe('newId', () => {
  it('is 32 hex characters and unique', () => {
    const a = newId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(newId()).not.toBe(a);
  });
});
