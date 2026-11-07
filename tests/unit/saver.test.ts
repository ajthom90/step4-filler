import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createKey, decrypt } from '../../src/core/crypto';
import { emptyDoc, type InventoryDoc } from '../../src/core/doc';
import { MAX_FILE_BYTES, parseSaved } from '../../src/core/fileformat';
import { Saver, STORAGE_KEY, type SaveStatus } from '../../src/core/saver';
import { FileError } from '../../src/core/validate';

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  failWrites: Error | null = null;
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(k: string) { return this.data.get(k) ?? null; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  removeItem(k: string) { this.data.delete(k); }
  setItem(k: string, v: string) {
    if (this.failWrites) throw this.failWrites;
    this.data.set(k, v);
  }
}

const god = { kind: 'god', custom: '' } as const;
function docWith(name: string): InventoryDoc {
  const d = emptyDoc('food', god);
  d.resentments.push({
    id: 'a'.repeat(32), name, causes: [], prayerDone: false,
    selfish: '', dishonest: '', selfSeeking: '', frightened: '',
  });
  return d;
}
function quota(): Error {
  const e = new Error('full');
  e.name = 'QuotaExceededError';
  return e;
}

let storage: MemoryStorage;
let statuses: SaveStatus[];
let win: EventTarget;
function make(ms = 800): Saver {
  return new Saver(storage, (s) => statuses.push(s), ms);
}
function otherTabWrote(value: string | null): void {
  win.dispatchEvent(Object.assign(new Event('storage'), { key: STORAGE_KEY, newValue: value }));
}

beforeEach(() => {
  vi.useFakeTimers();
  storage = new MemoryStorage();
  statuses = [];
  win = new EventTarget();
  vi.stubGlobal('window', win);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Saver', () => {
  it('writes nothing in mode none', async () => {
    const s = make();
    s.edited(docWith('Pat'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(storage.length).toBe(0);
    expect(statuses).toEqual([]);
  });

  it('plain mode autosaves after the debounce', async () => {
    const s = make();
    await s.setMode({ kind: 'browser-plain' }, docWith('first'));
    statuses.length = 0;
    s.edited(docWith('Pat'));
    await vi.advanceTimersByTimeAsync(799);
    expect(storage.getItem(STORAGE_KEY)).not.toContain('Pat');
    await vi.advanceTimersByTimeAsync(1);
    expect(parseSaved(storage.getItem(STORAGE_KEY)!)).toMatchObject({ kind: 'plain' });
    expect(storage.getItem(STORAGE_KEY)).toContain('Pat');
    expect(statuses).toEqual(['unsaved', 'saving', 'saved']);
  });

  it('collapses rapid edits into one write of the latest document', async () => {
    const s = make();
    await s.setMode({ kind: 'browser-plain' }, docWith('first'));
    const spy = vi.spyOn(storage, 'setItem');
    s.edited(docWith('one'));
    await vi.advanceTimersByTimeAsync(500);
    s.edited(docWith('two'));
    await vi.advanceTimersByTimeAsync(800);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(storage.getItem(STORAGE_KEY)).toContain('two');
  });

  it('encrypted mode never stores readable text', async () => {
    const s = make();
    const session = await createKey('longenough');
    await s.setMode({ kind: 'browser-encrypted', session }, docWith('first'));
    s.edited(docWith('Secret Person'));
    await vi.advanceTimersByTimeAsync(800);
    await s.flush(); // real crypto finishes outside fake time
    const raw = storage.getItem(STORAGE_KEY)!;
    expect(raw).not.toContain('Secret Person');
    expect(raw).not.toContain('first');
    const parsed = parseSaved(raw);
    if (parsed.kind !== 'encrypted') throw new Error('expected encrypted');
    const { doc } = await decrypt(parsed.envelope, 'longenough');
    expect(doc.resentments[0].name).toBe('Secret Person');
  });

  it('quota failure reports failed, keeps the old value, and the next edit retries', async () => {
    const s = make();
    await s.setMode({ kind: 'browser-plain' }, docWith('old'));
    const before = storage.getItem(STORAGE_KEY);
    storage.failWrites = quota();
    s.edited(docWith('new'));
    await vi.advanceTimersByTimeAsync(800);
    expect(statuses.at(-1)).toBe('failed');
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
    storage.failWrites = null;
    s.edited(docWith('newer'));
    await vi.advanceTimersByTimeAsync(800);
    expect(statuses.at(-1)).toBe('saved');
    expect(storage.getItem(STORAGE_KEY)).toContain('newer');
  });

  it('reports failed when a write exceeds the size limit and leaves the old save', async () => {
    const s = make();
    await s.setMode({ kind: 'browser-plain' }, docWith('old'));
    const before = storage.getItem(STORAGE_KEY);
    s.edited(docWith('x'.repeat(MAX_FILE_BYTES + 1)));
    await vi.advanceTimersByTimeAsync(800);
    expect(statuses.at(-1)).toBe('failed');
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
    s.edited(docWith('small again'));
    await vi.advanceTimersByTimeAsync(800);
    expect(statuses.at(-1)).toBe('saved');
    expect(storage.getItem(STORAGE_KEY)).toContain('small again');
  });

  it('fileContents rejects with too-large past the limit', async () => {
    const s = make();
    const big = docWith('x'.repeat(MAX_FILE_BYTES + 1));
    await expect(s.fileContents(big)).rejects.toMatchObject({ code: 'too-large' });
    await expect(s.fileContents(big)).rejects.toBeInstanceOf(FileError);
    const ok = await s.fileContents(docWith('Pat'));
    expect(parseSaved(ok)).toMatchObject({ kind: 'plain' });
    const session = await createKey('longenough');
    const enc = await s.fileContents(docWith('Pat'), session);
    expect(enc).not.toContain('Pat');
    expect(parseSaved(enc).kind).toBe('encrypted');
  });

  it('null storage: unavailable, and browser modes reject', async () => {
    const s = new Saver(null, (x) => statuses.push(x));
    expect(s.browserSaveAvailable).toBe(false);
    await expect(s.setMode({ kind: 'browser-plain' }, docWith('a'))).rejects.toThrow();
    expect(s.loadRaw()).toBeNull();
    expect(() => s.eraseAll()).not.toThrow();
    await expect(s.setMode({ kind: 'none' }, docWith('a'))).resolves.toBeUndefined();
  });

  it('a change from another tab marks stale and blocks writes until setMode', async () => {
    const s = make();
    await s.setMode({ kind: 'browser-plain' }, docWith('mine'));
    otherTabWrote('{"theirs":true}');
    expect(statuses.at(-1)).toBe('stale');
    storage.setItem(STORAGE_KEY, '{"theirs":true}');
    s.edited(docWith('later'));
    await vi.advanceTimersByTimeAsync(5000);
    await s.flush();
    expect(storage.getItem(STORAGE_KEY)).toBe('{"theirs":true}');
    expect(statuses.at(-1)).toBe('stale');
    await s.setMode({ kind: 'browser-plain' }, docWith('chosen'), { overwriteStale: true });
    expect(statuses.at(-1)).toBe('saved');
    expect(storage.getItem(STORAGE_KEY)).toContain('chosen');
    s.edited(docWith('after'));
    await vi.advanceTimersByTimeAsync(800);
    expect(storage.getItem(STORAGE_KEY)).toContain('after');
  });

  it('staleness cancels a write already scheduled', async () => {
    const s = make();
    await s.setMode({ kind: 'browser-plain' }, docWith('mine'));
    s.edited(docWith('pending'));
    otherTabWrote('{"theirs":true}');
    storage.setItem(STORAGE_KEY, '{"theirs":true}');
    await vi.advanceTimersByTimeAsync(5000);
    expect(storage.getItem(STORAGE_KEY)).toBe('{"theirs":true}');
  });

  it('ignores storage events for other keys', async () => {
    const s = make();
    await s.setMode({ kind: 'browser-plain' }, docWith('mine'));
    win.dispatchEvent(Object.assign(new Event('storage'), { key: 'other', newValue: 'x' }));
    expect(statuses.at(-1)).toBe('saved');
  });

  it('a failed mode change keeps the old save and the old mode', async () => {
    const s = make();
    await s.setMode({ kind: 'browser-plain' }, docWith('old'));
    const before = storage.getItem(STORAGE_KEY);
    storage.failWrites = quota();
    const session = await createKey('longenough');
    await expect(s.setMode({ kind: 'browser-encrypted', session }, docWith('new'))).rejects.toThrow('full');
    expect(statuses.at(-1)).toBe('failed');
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
    storage.failWrites = null;
    s.edited(docWith('still plain'));
    await vi.advanceTimersByTimeAsync(800);
    expect(parseSaved(storage.getItem(STORAGE_KEY)!).kind).toBe('plain');
  });

  it('flush writes a pending edit at once', async () => {
    const s = make();
    await s.setMode({ kind: 'browser-plain' }, docWith('first'));
    s.edited(docWith('urgent'));
    await s.flush();
    expect(storage.getItem(STORAGE_KEY)).toContain('urgent');
    expect(statuses.at(-1)).toBe('saved');
  });

  it('eraseAll removes the key and cancels pending writes', async () => {
    const s = make();
    await s.setMode({ kind: 'browser-plain' }, docWith('first'));
    s.edited(docWith('pending'));
    s.eraseAll();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    await vi.advanceTimersByTimeAsync(5000);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('lock clears the session and cancels timers', async () => {
    const s = make();
    const session = await createKey('longenough');
    await s.setMode({ kind: 'browser-encrypted', session }, docWith('first'));
    const before = storage.getItem(STORAGE_KEY);
    s.edited(docWith('pending'));
    s.lock();
    await vi.advanceTimersByTimeAsync(5000);
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
    s.edited(docWith('after lock'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
  });

  it('loadRaw survives a throwing getItem', () => {
    storage.getItem = () => { throw new Error('blocked'); };
    expect(make().loadRaw()).toBeNull();
  });

  describe('review fixes', () => {
    it('C1: an edit and flush during setMode never writes under the old mode', async () => {
      const s = make();
      await s.setMode({ kind: 'browser-plain' }, docWith('first'));
      const session = await createKey('longenough');
      const p = s.setMode({ kind: 'browser-encrypted', session }, docWith('first'));
      s.edited(docWith('TYPED-SECRET'));
      await s.flush();
      await p;
      const raw = storage.getItem(STORAGE_KEY)!;
      expect(raw).not.toContain('TYPED-SECRET');
      expect(parseSaved(raw).kind).toBe('encrypted');
      expect(statuses.at(-1)).toBe('saved');
    });

    it('I1a: a tab in mode none learns another tab saved, and unlocking without the option cannot overwrite', async () => {
      const s = make();
      expect(s.loadRaw()).toBeNull();
      storage.setItem(STORAGE_KEY, '{"theirs":true}');
      otherTabWrote('{"theirs":true}');
      expect(statuses.at(-1)).toBe('stale');
      const session = await createKey('longenough');
      await expect(s.setMode({ kind: 'browser-encrypted', session }, docWith('mine'))).rejects.toThrow();
      expect(storage.getItem(STORAGE_KEY)).toBe('{"theirs":true}');
      expect(statuses.at(-1)).toBe('stale');
    });

    it('overwriteStale deliberately replaces the newer save', async () => {
      const s = make();
      s.loadRaw();
      storage.setItem(STORAGE_KEY, '{"theirs":true}');
      otherTabWrote('{"theirs":true}');
      const session = await createKey('longenough');
      await s.setMode({ kind: 'browser-encrypted', session }, docWith('mine'), { overwriteStale: true });
      expect(parseSaved(storage.getItem(STORAGE_KEY)!).kind).toBe('encrypted');
      expect(statuses.at(-1)).toBe('saved');
    });

    it('I3c: an edit during an overwriting setMode from stale is held and written', async () => {
      const s = make();
      await s.setMode({ kind: 'browser-plain' }, docWith('first'));
      storage.setItem(STORAGE_KEY, '{"theirs":true}');
      otherTabWrote('{"theirs":true}');
      const p = s.setMode({ kind: 'browser-plain' }, docWith('mine'), { overwriteStale: true });
      s.edited(docWith('DURING'));
      await p;
      expect(statuses.at(-1)).toBe('unsaved');
      await vi.advanceTimersByTimeAsync(800);
      expect(storage.getItem(STORAGE_KEY)).toContain('DURING');
      expect(statuses.at(-1)).toBe('saved');
    });

    it('I3c: the same, encrypted, decrypts to the held edit', async () => {
      const s = make();
      await s.setMode({ kind: 'browser-plain' }, docWith('first'));
      storage.setItem(STORAGE_KEY, '{"theirs":true}');
      otherTabWrote('{"theirs":true}');
      const session = await createKey('longenough');
      const p = s.setMode({ kind: 'browser-encrypted', session }, docWith('mine'), { overwriteStale: true });
      s.edited(docWith('DURING'));
      await p;
      await vi.advanceTimersByTimeAsync(800);
      await s.flush();
      const raw = storage.getItem(STORAGE_KEY)!;
      expect(raw).not.toContain('DURING');
      const parsed = parseSaved(raw);
      if (parsed.kind !== 'encrypted') throw new Error('expected encrypted');
      expect((await decrypt(parsed.envelope, 'longenough')).doc.resentments[0].name).toBe('DURING');
      expect(statuses.at(-1)).toBe('saved');
    });

    it('I1b: a missed storage event is caught by comparing with the baseline before writing', async () => {
      const s = make();
      await s.setMode({ kind: 'browser-plain' }, docWith('mine'));
      storage.setItem(STORAGE_KEY, '{"theirs":true}'); // no event delivered
      s.edited(docWith('later'));
      await vi.advanceTimersByTimeAsync(800);
      expect(storage.getItem(STORAGE_KEY)).toBe('{"theirs":true}');
      expect(statuses.at(-1)).toBe('stale');
    });

    it('I1b: setMode from a non-stale state also refuses a changed baseline', async () => {
      const s = make();
      s.loadRaw();
      storage.setItem(STORAGE_KEY, '{"theirs":true}'); // no event delivered
      await expect(s.setMode({ kind: 'browser-plain' }, docWith('mine'))).rejects.toThrow();
      expect(storage.getItem(STORAGE_KEY)).toBe('{"theirs":true}');
      expect(statuses.at(-1)).toBe('stale');
    });

    it('I2: a stale event during setMode rejects it and leaves the stale status', async () => {
      const s = make();
      await s.setMode({ kind: 'browser-plain' }, docWith('first'));
      const readable = storage.getItem(STORAGE_KEY);
      const session = await createKey('longenough');
      const p = s.setMode({ kind: 'browser-encrypted', session }, docWith('first'));
      const settled = expect(p).rejects.toThrow();
      otherTabWrote('{"theirs":true}');
      await settled;
      expect(statuses.at(-1)).toBe('stale');
      expect(storage.getItem(STORAGE_KEY)).toBe(readable);
    });

    it('I3a: an edit during the first setMode is saved, not discarded', async () => {
      const s = make();
      const p = s.setMode({ kind: 'browser-plain' }, docWith('first'));
      s.edited(docWith('during'));
      await p;
      expect(statuses.at(-1)).toBe('unsaved');
      await vi.advanceTimersByTimeAsync(800);
      expect(storage.getItem(STORAGE_KEY)).toContain('during');
      expect(statuses.at(-1)).toBe('saved');
    });

    it('I3b: setMode does not report saved while an edit is pending', async () => {
      const s = make();
      await s.setMode({ kind: 'browser-plain' }, docWith('first'));
      const p = s.setMode({ kind: 'browser-plain' }, docWith('first'));
      s.edited(docWith('newer'));
      await p;
      expect(statuses.at(-1)).toBe('unsaved');
      await vi.advanceTimersByTimeAsync(800);
      expect(storage.getItem(STORAGE_KEY)).toContain('newer');
    });

    it('S1(1): an edit held during a setMode that is then abandoned stale never overwrites the other tab', async () => {
      const s = make();
      await s.setMode({ kind: 'browser-plain' }, docWith('first'));
      const session = await createKey('longenough');
      const p = s.setMode({ kind: 'browser-encrypted', session }, docWith('first'));
      const settled = expect(p).rejects.toThrow();
      otherTabWrote('{"theirs":true}');
      storage.setItem(STORAGE_KEY, '{"theirs":true}');
      s.edited(docWith('HELD-SECRET'));
      await settled;
      await vi.advanceTimersByTimeAsync(5000);
      await s.flush();
      expect(storage.getItem(STORAGE_KEY)).toBe('{"theirs":true}');
    });

    it('S1(2): loadRaw after an abandoned setMode leaves nothing for the held edit to write', async () => {
      const s = make();
      await s.setMode({ kind: 'browser-plain' }, docWith('first'));
      const session = await createKey('longenough');
      const p = s.setMode({ kind: 'browser-encrypted', session }, docWith('first'));
      const settled = expect(p).rejects.toThrow();
      otherTabWrote('{"theirs":true}');
      storage.setItem(STORAGE_KEY, '{"theirs":true}');
      s.edited(docWith('HELD-SECRET'));
      await settled;
      s.loadRaw();
      await vi.advanceTimersByTimeAsync(5000);
      await s.flush();
      expect(storage.getItem(STORAGE_KEY)).toBe('{"theirs":true}');
      expect(storage.getItem(STORAGE_KEY)).not.toContain('HELD-SECRET');
    });

    it('S1(3): after loadRaw, edits write nothing until setMode', async () => {
      const s = make();
      await s.setMode({ kind: 'browser-plain' }, docWith('first'));
      const before = storage.getItem(STORAGE_KEY);
      s.loadRaw();
      s.edited(docWith('AFTER-LOAD'));
      await vi.advanceTimersByTimeAsync(5000);
      await s.flush();
      expect(storage.getItem(STORAGE_KEY)).toBe(before);
      await s.setMode({ kind: 'browser-plain' }, docWith('chosen'));
      s.edited(docWith('later'));
      await vi.advanceTimersByTimeAsync(800);
      expect(storage.getItem(STORAGE_KEY)).toContain('later');
    });

    it('S1(4): an edit after lock during an unwinding setMode leaves no timer and no write', async () => {
      const s = make();
      await s.setMode({ kind: 'browser-plain' }, docWith('first'));
      const before = storage.getItem(STORAGE_KEY);
      const session = await createKey('longenough');
      const p = s.setMode({ kind: 'browser-encrypted', session }, docWith('first'));
      const settled = p.catch(() => undefined);
      s.lock();
      s.edited(docWith('AFTER-LOCK'));
      expect(vi.getTimerCount()).toBe(0);
      await settled;
      await vi.advanceTimersByTimeAsync(5000);
      await s.flush();
      expect(storage.getItem(STORAGE_KEY)).toBe(before);
    });
  });
});
