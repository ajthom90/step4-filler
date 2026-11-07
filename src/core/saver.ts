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
  private queue: Promise<unknown> = Promise.resolve();
  private lastWritten: string | null = null;

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
    if (newValue === this.lastWritten) return;
    if (this.mode.kind === 'none') return;
    this.stale = true;
    this.epoch++;
    this.cancelTimer();
    this.pending = null;
    this.onStatus('stale');
  };

  private cancelTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Throws on failure; the previous stored value is replaced only by a successful setItem. */
  private async writeNow(doc: InventoryDoc, mode: SaveMode, epoch: number): Promise<boolean> {
    if (mode.kind === 'none' || !this.storage) return false;
    const text = await render(doc, mode.kind === 'browser-encrypted' ? mode.session : undefined);
    if (epoch !== this.epoch) return false; // locked, erased, or gone stale meanwhile
    this.storage.setItem(STORAGE_KEY, text);
    this.lastWritten = text;
    return true;
  }

  async setMode(mode: SaveMode, doc: InventoryDoc): Promise<void> {
    if (mode.kind !== 'none' && !this.storage) {
      throw new Error('Browser storage is unavailable');
    }
    this.cancelTimer();
    this.pending = null;
    const epoch = ++this.epoch;
    await this.serial(async () => {
      if (mode.kind === 'none') {
        this.mode = mode;
        this.stale = false;
        this.onStatus('unsaved');
        return;
      }
      this.onStatus('saving');
      try {
        const wrote = await this.writeNow(doc, mode, epoch);
        if (!wrote) return;
      } catch (err) {
        // The old mode and the old save stay as they were.
        this.onStatus('failed');
        throw err;
      }
      this.mode = mode;
      this.stale = false;
      this.onStatus('saved');
    });
  }

  edited(doc: InventoryDoc): void {
    if (this.mode.kind === 'none' || this.stale) return;
    this.pending = doc;
    this.onStatus('unsaved');
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.commit();
    }, this.debounceMs);
  }

  private commit(): Promise<void> {
    const doc = this.pending;
    if (!doc || this.mode.kind === 'none' || this.stale) return Promise.resolve();
    this.pending = null;
    const { epoch } = this;
    const mode = this.mode;
    return this.serial(async () => {
      if (epoch !== this.epoch) return;
      this.onStatus('saving');
      try {
        if (await this.writeNow(doc, mode, epoch)) {
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
    this.stale = false;
  }

  loadRaw(): string | null {
    try {
      return this.storage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  eraseAll(): void {
    this.lock();
    this.lastWritten = null;
    try {
      this.storage?.removeItem(STORAGE_KEY);
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
