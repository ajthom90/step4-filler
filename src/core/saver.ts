import { encrypt, type SessionKey } from './crypto';
import type { InventoryDoc } from './doc';
import { MAX_FILE_BYTES, serialize } from './fileformat';
import { FileError } from './validate';

export const STORAGE_KEY = 'step4-inventory';

export type SaveMode =
  | { kind: 'none' }
  | { kind: 'browser-plain' }
  | { kind: 'browser-encrypted'; session: SessionKey };
export type SaveStatus = 'unsaved' | 'saving' | 'saved' | 'failed' | 'stale';

/** The site cannot reopen anything larger, so it must never write it. */
function checkSize(text: string): void {
  // UTF-8 is never shorter than the UTF-16 length, so the cheap check goes first.
  if (text.length > MAX_FILE_BYTES || new TextEncoder().encode(text).length > MAX_FILE_BYTES) {
    throw new FileError('too-large');
  }
}

async function render(doc: InventoryDoc, session?: SessionKey): Promise<string> {
  const text = serialize(session ? await encrypt(doc, session) : doc);
  checkSize(text);
  return text;
}

export class Saver {
  readonly browserSaveAvailable: boolean;

  private mode: SaveMode = { kind: 'none' };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: InventoryDoc | null = null;
  private stale = false;
  /** Bumped by anything that must abandon writes already under way. */
  private epoch = 0;
  private modeSeq = 0;
  /** Mode changes queued or running; edits made meanwhile are held, not dropped. */
  private changing = 0;
  /** The epoch of the newest setMode; edits are held only while it is still current. */
  private changeEpoch = -1;
  private queue: Promise<unknown> = Promise.resolve();
  /** What storage held when we last read or wrote it; undefined until first known. */
  private known: string | null | undefined;

  constructor(
    private readonly storage: Storage | null,
    private readonly onStatus: (s: SaveStatus) => void,
    private readonly debounceMs = 800,
  ) {
    this.browserSaveAvailable = storage !== null;
    if (typeof window !== 'undefined') window.addEventListener('storage', this.onStorage);
  }

  private readonly onStorage = (e: Event): void => {
    const { key, newValue } = e as Event & { key: string | null; newValue: string | null };
    // key is null when another tab clears all storage.
    if (key !== null && key !== STORAGE_KEY) return;
    if (this.known === undefined || newValue === this.known) return;
    this.markStale();
  };

  private markStale(): void {
    this.stale = true;
    this.epoch++;
    this.cancelTimer();
    this.pending = null;
    this.onStatus('stale');
  }

  private cancelTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /**
   * Throws on failure; the previous stored value is replaced only by a successful setItem.
   * Returns false when the write was abandoned (locked, erased, or another tab got there first).
   * `overwrite` skips the check against what we last saw: only a deliberate setMode from stale.
   */
  private async writeNow(doc: InventoryDoc, mode: SaveMode, epoch: number, overwrite: boolean): Promise<boolean> {
    if (mode.kind === 'none' || !this.storage) return false;
    const text = await render(doc, mode.kind === 'browser-encrypted' ? mode.session : undefined);
    if (epoch !== this.epoch) return false; // locked, erased, or gone stale meanwhile
    // The storage event can be missed (frozen or restored tabs), so look before writing.
    if (!overwrite && this.known !== undefined && this.storage.getItem(STORAGE_KEY) !== this.known) {
      this.markStale();
      return false;
    }
    this.storage.setItem(STORAGE_KEY, text);
    this.known = text;
    return true;
  }

  async setMode(mode: SaveMode, doc: InventoryDoc, options?: { overwriteStale?: boolean }): Promise<void> {
    if (mode.kind !== 'none' && !this.storage) {
      throw new Error('Browser storage is unavailable');
    }
    // A newer save from another tab is replaced only when the caller says so.
    const overwrite = this.stale && options?.overwriteStale === true;
    if (this.stale && mode.kind !== 'none' && !overwrite) this.abandoned();
    this.cancelTimer();
    this.pending = null;
    const epoch = ++this.epoch;
    this.changeEpoch = epoch;
    const seq = ++this.modeSeq;
    this.changing++;
    try {
      await this.serial(async () => {
        if (seq !== this.modeSeq) return; // superseded by a newer setMode
        if (epoch !== this.epoch) return this.abandoned();
        if (mode.kind === 'none') {
          this.mode = mode;
          this.onStatus(this.stale ? 'stale' : 'unsaved');
          return;
        }
        this.onStatus('saving');
        let wrote: boolean;
        try {
          wrote = await this.writeNow(doc, mode, epoch, overwrite);
        } catch (err) {
          // The old mode and the old save stay as they were.
          this.onStatus('failed');
          throw err;
        }
        if (seq !== this.modeSeq) return;
        if (!wrote) return this.abandoned();
        this.mode = mode;
        this.stale = false;
        this.onStatus(this.pending === null ? 'saved' : 'unsaved');
      });
    } catch (err) {
      // Whatever was held belongs to a save that did not happen; never let it write later.
      if (this.stale) {
        this.cancelTimer();
        this.pending = null;
      }
      throw err;
    } finally {
      this.changing--;
    }
  }

  private abandoned(): never {
    if (this.stale) this.onStatus('stale');
    throw new Error('The save mode change was abandoned');
  }

  edited(doc: InventoryDoc): void {
    const holding = this.changing > 0 && this.changeEpoch === this.epoch;
    if (!holding && (this.stale || this.mode.kind === 'none')) return;
    this.pending = doc;
    this.onStatus('unsaved');
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.commit();
    }, this.debounceMs);
  }

  private commit(): Promise<void> {
    // Everything is read inside the task, after any mode change ahead of it has finished.
    return this.serial(async () => {
      const doc = this.pending;
      const { mode } = this;
      if (!doc || mode.kind === 'none' || this.stale) return;
      this.pending = null;
      const { epoch } = this;
      this.onStatus('saving');
      try {
        if (await this.writeNow(doc, mode, epoch, false)) {
          // A newer edit arrived while saving: it has its own timer and keeps the status.
          if (this.pending === null) this.onStatus('saved');
        }
      } catch {
        // Retried by the next edit; the work stays in memory in the caller.
        if (epoch === this.epoch) this.onStatus('failed');
      }
    });
  }

  async flush(): Promise<void> {
    this.cancelTimer();
    await this.commit();
    await this.queue;
  }

  lock(): void {
    this.cancelTimer();
    this.pending = null;
    this.epoch++;
    this.mode = { kind: 'none' };
  }

  /**
   * Adopts the stored value: it becomes the baseline, and anything pending or in flight is
   * dropped. Writing resumes only through setMode.
   */
  loadRaw(): string | null {
    this.cancelTimer();
    this.pending = null;
    this.epoch++;
    this.mode = { kind: 'none' };
    try {
      const value = this.storage?.getItem(STORAGE_KEY) ?? null;
      if (this.storage) {
        this.known = value;
        this.stale = false;
      }
      return value;
    } catch {
      return null;
    }
  }

  eraseAll(): void {
    this.lock();
    this.stale = false;
    try {
      this.storage?.removeItem(STORAGE_KEY);
      this.known = null;
    } catch {
      // Nothing more can be done; the caller sees the key again on reload.
    }
  }

  fileContents(doc: InventoryDoc, session?: SessionKey): Promise<string> {
    return render(doc, session);
  }

  async requestPersistence(): Promise<boolean> {
    try {
      return (await navigator.storage?.persist?.()) ?? false;
    } catch {
      return false;
    }
  }
}
