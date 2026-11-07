import { saveCopy } from '../content/copy';
import { dismissPrompt, useApp } from './store';

/** Committed edits before the first prompt, and between later prompts after "Not now". */
export const SAVE_PROMPT_AFTER = 3;
export const SAVE_REPROMPT_EVERY = 10;

/**
 * Asks how to save once there is something worth keeping. Nothing is written to storage
 * until a choice is made on the save screen.
 */
export function SavePrompt() {
  const { state } = useApp();
  const threshold = state.promptDismissed ? SAVE_REPROMPT_EVERY : SAVE_PROMPT_AFTER;
  const quiet = state.route.name === 'save' || state.route.name === 'unlock';
  if (!state.doc || state.mode.kind !== 'none' || quiet || state.editsSincePrompt < threshold) return null;
  return (
    <section class="notice" aria-labelledby="save-prompt-title">
      <h2 id="save-prompt-title">{saveCopy.promptHeading}</h2>
      <p>{saveCopy.promptText}</p>
      <p class="actions">
        <a class="button primary" href="#/save">{saveCopy.promptChoose}</a>
        <button type="button" onClick={dismissPrompt}>{saveCopy.promptLater}</button>
      </p>
    </section>
  );
}
