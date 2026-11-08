import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';

/**
 * A question with two answers, announced as an alert dialog named by its visible title. Keyboard focus moves
 * to the No button when it opens, so the question is not missed, focus never drops to the page, and a second
 * press of Enter keeps things as they are instead of doing something that can't be undone.
 * The caller returns focus to what opened it on cancel (see useFocusReturn).
 */
export function Confirm({ title, children, yes, no, onYes, onNo }: {
  title: string; children: ComponentChildren; yes: string; no: string; onYes: () => void; onNo: () => void;
}) {
  const id = useId();
  const noButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    noButton.current?.focus();
  }, []);
  return (
    <div class="notice" role="alertdialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-text`}>
      <p id={`${id}-title`}><strong>{title}</strong></p>
      <p id={`${id}-text`}>{children}</p>
      <p class="actions">
        <button type="button" class="primary" onClick={onYes}>{yes}</button>
        <button ref={noButton} type="button" onClick={onNo}>{no}</button>
      </p>
    </div>
  );
}

/**
 * Puts focus back on the control that opened a question, once the question has closed. The control is
 * often drawn again in its place, so it is found by its ref after that render rather than remembered.
 * `trigger(key)` is the ref for a control; `restore(key)` sends focus back to it.
 */
export function useFocusReturn(): { trigger: (key?: string) => (el: HTMLElement | null) => void; restore: (key?: string) => void } {
  const controls = useRef(new Map<string, HTMLElement>());
  const [target, setTarget] = useState<{ key: string } | null>(null);
  useEffect(() => {
    if (target) controls.current.get(target.key)?.focus();
  }, [target]);
  return {
    trigger: (key = '') => (el) => {
      if (el) controls.current.set(key, el);
    },
    restore: (key = '') => setTarget({ key }),
  };
}
