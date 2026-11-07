import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { PASSWORD_WARNING, PLAIN_WARNING, saveCopy } from '../../content/copy';
import type { SaveMode } from '../../core/saver';
import { createKey, decrypt, type Envelope, type SessionKey } from '../../core/crypto';
import type { InventoryDoc } from '../../core/doc';
import { MAX_FILE_BYTES, parseSaved } from '../../core/fileformat';
import { FileError } from '../../core/validate';
import { downloadBackup, eraseBrowserData, isStale, openDocument, ReplaceRefused, storedSaveIsReplaceableByReadable, useApp } from '../store';

const MIN_PASSWORD = 8;

type Message = { kind: 'ok' | 'error'; text: string } | null;

/** Why a save or download did not happen, in words for the person. */
function failureText(err: unknown): string {
  if (err instanceof FileError && err.code === 'too-large') return saveCopy.tooLarge;
  if (err instanceof ReplaceRefused) return saveCopy.staleNoReplace;
  if (isStale()) return saveCopy.stale;
  return saveCopy.saveFailed;
}

function passwordProblem(password: string, again: string): string | null {
  if (password.length < MIN_PASSWORD) return saveCopy.tooShort;
  if (password !== again) return saveCopy.mismatch;
  return null;
}

/** Two password fields. A password manager is asked for a new password, not an existing one. */
function PasswordFields({ label, againLabel, password, again, onPassword, onAgain, hint }: {
  label: string; againLabel: string; password: string; again: string;
  onPassword: (v: string) => void; onAgain: (v: string) => void; hint?: string;
}) {
  return (
    <>
      <label class="field">
        <span>{label}</span>
        <input type="password" value={password} autocomplete="new-password" onInput={(e) => onPassword((e.currentTarget as HTMLInputElement).value)} />
      </label>
      {hint && <p class="note">{hint}</p>}
      <label class="field">
        <span>{againLabel}</span>
        <input type="password" value={again} autocomplete="new-password" onInput={(e) => onAgain((e.currentTarget as HTMLInputElement).value)} />
      </label>
    </>
  );
}

/** A question with two answers, announced as a group so it is not missed. */
function Confirm({ title, children, yes, no, onYes, onNo }: {
  title: string; children: ComponentChildren; yes: string; no: string; onYes: () => void; onNo: () => void;
}) {
  return (
    <div class="notice" role="group" aria-label={title}>
      <p>{children}</p>
      <p class="actions">
        <button type="button" class="primary" onClick={onYes}>{yes}</button>
        <button type="button" onClick={onNo}>{no}</button>
      </p>
    </div>
  );
}

/** Deletes the browser save, and with it the inventory on this page. Used where the inventory is not open too. */
export function EraseEverything() {
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <section>
      <h2>{saveCopy.eraseHeading}</h2>
      {failed && <p class="notice alert" role="alert">{saveCopy.eraseFailed}</p>}
      {asking ? (
        <Confirm
          title={saveCopy.eraseHeading}
          yes={saveCopy.eraseYes}
          no={saveCopy.eraseKeep}
          onYes={() => {
            if (!eraseBrowserData(false)) {
              setFailed(true);
              setAsking(false);
            }
          }}
          onNo={() => setAsking(false)}
        >
          {saveCopy.eraseText}
        </Confirm>
      ) : (
        <button type="button" onClick={() => { setFailed(false); setAsking(true); }}>{saveCopy.labels.eraseButton}</button>
      )}
    </section>
  );
}

type Opened = { doc: InventoryDoc; session?: SessionKey };
type Step = { name: 'idle' } | { name: 'password'; envelope: Envelope } | { name: 'confirm'; opened: Opened };

function openErrorText(err: unknown): string {
  return err instanceof FileError ? saveCopy.fileErrors[err.code] : saveCopy.fileErrorOther;
}

/**
 * Opens a downloaded file. Every file is untrusted: its size is checked before it is read,
 * it is validated before anything else happens, and what is open here is replaced only after
 * an explicit yes. Any failure leaves the current inventory untouched.
 */
export function OpenFile() {
  const { state } = useApp();
  const [step, setStep] = useState<Step>({ name: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const existing = state.doc !== null || state.pendingEnvelope !== null;
  const finish = async (opened: Opened) => {
    if (!existing) return apply(opened);
    setStep({ name: 'confirm', opened });
  };
  const apply = async ({ doc, session }: Opened) => {
    setStep({ name: 'idle' });
    setPassword('');
    // If keeping it saved here fails, the store leaves a notice on screen; it outlives this component.
    await openDocument(doc, session);
  };

  const onFile = async (file: File | undefined) => {
    setError(null);
    setStep({ name: 'idle' });
    setPassword('');
    if (!file) return;
    try {
      if (file.size > MAX_FILE_BYTES) throw new FileError('too-large');
      const parsed = parseSaved(await file.text());
      if (parsed.kind === 'plain') await finish({ doc: parsed.doc });
      else setStep({ name: 'password', envelope: parsed.envelope });
    } catch (err) {
      setError(openErrorText(err));
    }
  };

  const unlockFile = async (envelope: Envelope) => {
    setError(null);
    setBusy(true);
    try {
      const { doc, session } = await decrypt(envelope, password);
      await finish({ doc, session });
    } catch (err) {
      setError(openErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  const opening = step.name === 'confirm' ? step.opened : null;
  const replaceText = state.pendingEnvelope
    ? saveCopy.replaceLocked
    : state.mode.kind === 'none' ? saveCopy.replaceMemory
      : state.mode.kind === 'browser-plain' && opening?.session ? saveCopy.replaceBrowserEncrypted : saveCopy.replaceBrowser;

  return (
    <section>
      <h2>{saveCopy.openHeading}</h2>
      <p class="note">{saveCopy.openNote2}</p>
      <label class="field">
        <span>{saveCopy.labels.openFile}</span>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const el = e.currentTarget as HTMLInputElement;
            const file = el.files?.[0];
            el.value = ''; // choosing the same file again must still fire
            void onFile(file);
          }}
        />
      </label>
      {error && <p class="notice alert" role="alert">{error}</p>}
      {step.name === 'password' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void unlockFile(step.envelope);
          }}
        >
          <p>{saveCopy.filePasswordText}</p>
          <label class="field">
            <span>{saveCopy.labels.filePassword}</span>
            <input type="password" value={password} autocomplete="current-password" onInput={(e) => setPassword((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <p>
            <button type="submit" class="primary" disabled={busy}>{busy ? saveCopy.working : saveCopy.labels.openFileButton}</button>
          </p>
        </form>
      )}
      {step.name === 'confirm' && (
        <Confirm
          title={saveCopy.replaceHeading}
          yes={saveCopy.replaceYes}
          no="Cancel"
          onYes={() => void apply(step.opened)}
          onNo={() => setStep({ name: 'idle' })}
        >
          {replaceText}
        </Confirm>
      )}
    </section>
  );
}

export function Save() {
  const { state, saver, setSaveMode } = useApp();
  const doc = state.doc!;
  const mode = state.mode;
  const encrypted = mode.kind === 'browser-encrypted';
  // Asked of the saver, not the status: a failed attempt changes the status but the save is still stale.
  const stale = saver.isStale;

  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newAgain, setNewAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [asking, setAsking] = useState<'remove' | 'stop' | 'replace' | 'plain' | null>(null);
  // Set by confirming "replace" while no mode is active; it covers exactly one save attempt.
  const [armed, setArmed] = useState(false);

  const run = async (task: () => Promise<string>) => {
    setMessage(null);
    setBusy(true);
    try {
      setMessage({ kind: 'ok', text: await task() });
    } catch (err) {
      setMessage({ kind: 'error', text: failureText(err) });
    } finally {
      setBusy(false);
    }
  };
  const refuse = (text: string) => setMessage({ kind: 'error', text });

  const saveInBrowser = (withPassword: boolean, removeProtection = false) => {
    // An inventory that was under a password is saved as readable text only after this explicit question.
    if (!withPassword && state.requiredSession && !removeProtection) return setAsking('plain');
    setAsking(null);
    if (withPassword) {
      const problem = passwordProblem(password, again);
      if (problem) return refuse(problem);
    }
    const first = mode.kind === 'none';
    void run(async () => {
      const next = withPassword
        ? { kind: 'browser-encrypted' as const, session: await createKey(password) }
        : { kind: 'browser-plain' as const };
      const permission = armed;
      setArmed(false); // used up whether or not the save works
      await setSaveMode(next, { overwriteStale: permission, removeProtection });
      if (first) void saver.requestPersistence();
      setPassword('');
      setAgain('');
      return withPassword ? saveCopy.savedBrowserEncrypted : saveCopy.savedBrowserPlain;
    });
  };

  const downloadFile = (withPassword: boolean, held?: SessionKey) => {
    if (withPassword && !encrypted && !held) {
      const problem = passwordProblem(password, again);
      if (problem) return refuse(problem);
    }
    void run(async () => {
      const session = encrypted ? mode.session : held ?? (withPassword ? await createKey(password) : undefined);
      return saveCopy.downloaded(await downloadBackup(session));
    });
  };

  /** The confirmed replace of a newer save. With a mode in use it writes now; otherwise the next save may. */
  const replaceNewer = () => {
    setAsking(null);
    const required = state.requiredSession;
    if (mode.kind === 'none' && !required) return setArmed(true);
    // Never replace with a weaker mode than the inventory was under.
    const target: SaveMode = mode.kind === 'none' && required ? { kind: 'browser-encrypted', session: required } : mode;
    void run(async () => {
      await setSaveMode(target, { overwriteStale: true });
      return target.kind === 'browser-encrypted' ? saveCopy.savedBrowserEncrypted : saveCopy.savedBrowserPlain;
    });
  };

  const changePassword = () => {
    const problem = passwordProblem(newPassword, newAgain);
    if (problem) return refuse(problem);
    void run(async () => {
      await setSaveMode({ kind: 'browser-encrypted', session: await createKey(newPassword) });
      setNewPassword('');
      setNewAgain('');
      return saveCopy.passwordChanged;
    });
  };

  const removePassword = () => {
    setAsking(null);
    void run(async () => {
      await setSaveMode({ kind: 'browser-plain' }, { removeProtection: true });
      return saveCopy.passwordRemoved;
    });
  };

  const stopSaving = () => {
    setAsking(null);
    setMessage(eraseBrowserData(true) ? { kind: 'ok', text: saveCopy.stopped } : { kind: 'error', text: saveCopy.stopFailed });
  };

  // A readable page never replaces a password-protected save.
  const heldSession = encrypted ? mode.session : mode.kind === 'none' ? state.requiredSession : null;
  const canReplace = !stale || heldSession !== null || storedSaveIsReplaceableByReadable();
  const browserOk = saver.browserSaveAvailable;
  const where = mode.kind === 'none' ? saveCopy.rightNow.none : encrypted ? saveCopy.rightNow.encrypted : saveCopy.rightNow.plain;

  return (
    <>
      <h1 tabIndex={-1}>{saveCopy.title}</h1>
      <p>{saveCopy.intro}</p>
      <p class="note">{where}</p>
      {!browserOk && <p class="notice">{saveCopy.rightNow.unavailable}</p>}
      {message?.kind === 'error' && <p class="notice alert" role="alert">{message.text}</p>}
      <div aria-live="polite">{message?.kind === 'ok' && <p class="notice">{message.text}</p>}</div>

      {stale && !armed && (
        <section class="notice alert" aria-labelledby="stale-title">
          <h2 id="stale-title">{saveCopy.staleReplaceHeading}</h2>
          <p>{saveCopy.stale}</p>
          {!canReplace && <p>{saveCopy.staleNoReplace}</p>}
          <p class="actions">
            <button type="button" class="primary" onClick={() => window.location.reload()}>{saveCopy.staleReload}</button>
            {canReplace && asking !== 'replace' && <button type="button" onClick={() => setAsking('replace')}>{saveCopy.staleReplace}</button>}
          </p>
          {asking === 'replace' && (
            <Confirm
              title={saveCopy.staleReplaceHeading}
              yes={mode.kind === 'none' && !state.requiredSession ? saveCopy.staleReplaceYesChoose : saveCopy.staleReplaceYes}
              no="Cancel"
              onYes={replaceNewer}
              onNo={() => setAsking(null)}
            >
              {mode.kind === 'none' && !state.requiredSession ? saveCopy.staleReplaceChooseWarning : saveCopy.staleReplaceWarning}
            </Confirm>
          )}
        </section>
      )}

      {!(stale && !armed) && (encrypted ? (
        <>
          <section>
            <h2>{saveCopy.passwordHeading}</h2>
            <p>{PASSWORD_WARNING}</p>
            <p class="actions">
              <button type="button" disabled={busy} onClick={() => downloadFile(true)}>{saveCopy.labels.downloadPassword}</button>
            </p>
            <p class="note">{saveCopy.encryptedFileNote}</p>
          </section>
          <section>
            <h2>{saveCopy.changeHeading}</h2>
            <p>{PASSWORD_WARNING}</p>
            <PasswordFields
              label={saveCopy.labels.newPassword} againLabel={saveCopy.labels.typeNewAgain} hint={saveCopy.passwordHint}
              password={newPassword} again={newAgain} onPassword={setNewPassword} onAgain={setNewAgain}
            />
            <p><button type="button" disabled={busy} onClick={changePassword}>{busy ? saveCopy.working : saveCopy.changeButton}</button></p>
          </section>
          <section>
            <h2>{saveCopy.removeHeading}</h2>
            {asking === 'remove' ? (
              <Confirm title={saveCopy.removeHeading} yes={saveCopy.removeYes} no={saveCopy.removeKeep} onYes={removePassword} onNo={() => setAsking(null)}>
                {PLAIN_WARNING}
              </Confirm>
            ) : (
              <button type="button" disabled={busy} onClick={() => setAsking('remove')}>{saveCopy.removeButton}</button>
            )}
          </section>
        </>
      ) : (
        <>
          <section>
            <h2>{saveCopy.passwordHeading}</h2>
            <PasswordFields
              label={saveCopy.labels.password} againLabel={saveCopy.labels.typeAgain} hint={saveCopy.passwordHint}
              password={password} again={again} onPassword={setPassword} onAgain={setAgain}
            />
            <p>{PASSWORD_WARNING}</p>
            <p class="actions">
              <button type="button" class="primary" disabled={busy || !browserOk} onClick={() => saveInBrowser(true)}>
                {saveCopy.labels.saveBrowserPassword}
              </button>
              <button type="button" disabled={busy} onClick={() => downloadFile(true)}>{saveCopy.labels.downloadPassword}</button>
            </p>
          </section>
          <section>
            <h2>{saveCopy.plainHeading}</h2>
            <p>{PLAIN_WARNING}</p>
            {asking === 'plain' && (
              <Confirm
                title={saveCopy.removeHeading}
                yes={saveCopy.removeYes}
                no={saveCopy.removeKeep}
                onYes={() => saveInBrowser(false, true)}
                onNo={() => setAsking(null)}
              >
                {PLAIN_WARNING}
              </Confirm>
            )}
            <p class="actions">
              <button type="button" disabled={busy || !browserOk} onClick={() => saveInBrowser(false)}>{saveCopy.labels.saveBrowserPlain}</button>
              <button type="button" disabled={busy} onClick={() => downloadFile(false)}>{saveCopy.labels.downloadPlain}</button>
            </p>
          </section>
        </>
      ))}

      <section>
        <h2>{saveCopy.backupHeading}</h2>
        <p>{saveCopy.backup}</p>
        <p class="note">{saveCopy.openNote}</p>
        {stale && !armed && (
          <>
            {!heldSession && <p>{PLAIN_WARNING}</p>}
            <p class="actions">
              <button type="button" disabled={busy} onClick={() => downloadFile(heldSession !== null, heldSession ?? undefined)}>
                {heldSession ? saveCopy.labels.downloadPassword : saveCopy.labels.downloadPlain}
              </button>
            </p>
          </>
        )}
      </section>

      {mode.kind !== 'none' && !stale && (
        <section>
          <h2>{saveCopy.stopHeading}</h2>
          {asking === 'stop' ? (
            <Confirm title={saveCopy.stopHeading} yes={saveCopy.stopYes} no={saveCopy.stopKeep} onYes={stopSaving} onNo={() => setAsking(null)}>
              {saveCopy.stopText}
            </Confirm>
          ) : (
            <button type="button" disabled={busy} onClick={() => setAsking('stop')}>{saveCopy.stopHeading}</button>
          )}
        </section>
      )}
      <OpenFile />
      <p><a href="#/home">Back to your inventory</a></p>
    </>
  );
}
