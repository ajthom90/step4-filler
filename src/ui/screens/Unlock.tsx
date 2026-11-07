import { useState } from 'preact/hooks';
import { saveCopy } from '../../content/copy';
import { decrypt } from '../../core/crypto';
import { FileError } from '../../core/validate';
import { unlockWith, useApp } from '../store';
import { EraseEverything, OpenFile } from './Save';

export function Unlock() {
  const { state } = useApp();
  const envelope = state.pendingEnvelope;
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!envelope) return;
    setError(null);
    setBusy(true);
    try {
      const { doc, session } = await decrypt(envelope, password);
      setPassword('');
      // If another tab already changed the save, the inventory opens and the header says so.
      unlockWith(doc, session);
    } catch (err) {
      setError(err instanceof FileError && err.code === 'wrong-password' ? saveCopy.unlockWrong : saveCopy.unlockProblem);
      setBusy(false);
    }
  };

  return (
    <>
      <h1 tabIndex={-1}>{saveCopy.unlockTitle}</h1>
      {envelope ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p>{saveCopy.unlockText}</p>
          <label class="field">
            <span>{saveCopy.labels.password}</span>
            <input type="password" value={password} autocomplete="current-password" onInput={(e) => setPassword((e.currentTarget as HTMLInputElement).value)} />
          </label>
          {error && <p class="notice alert" role="alert">{error}</p>}
          <p>
            <button type="submit" class="primary" disabled={busy}>{busy ? saveCopy.working : saveCopy.labels.unlock}</button>
          </p>
        </form>
      ) : (
        <p class="notice alert" role="alert">{saveCopy.unlockProblem}</p>
      )}
      <h2>{saveCopy.forgotHeading}</h2>
      <p>{saveCopy.forgotText}</p>
      <OpenFile />
      <EraseEverything />
    </>
  );
}
