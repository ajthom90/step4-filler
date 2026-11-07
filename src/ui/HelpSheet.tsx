import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

/**
 * A modal sheet over the current step. It is a native dialog, so focus stays inside it,
 * Escape closes it, and focus returns to the button that opened it. The step underneath
 * stays mounted, so nothing typed there is lost.
 */
let sheets = 0;

/**
 * The button most recently pressed. Safari does not focus a button when it is clicked, so the native dialog
 * would have nothing to return focus to; this is what it is given instead.
 */
let pressed: HTMLElement | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    pressed = e.target instanceof Element ? e.target.closest<HTMLElement>('button') : null;
  }, true);
}

/** Remembers what opened a dialog, and returns a function that puts focus back there once it has closed. */
export function rememberOpener(): () => void {
  const opener = pressed ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  return () => {
    if (opener?.isConnected) opener.focus();
  };
}

export function HelpSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ComponentChildren }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Several sheets can be on one screen, so each names its own title.
  const titleId = useRef(`sheet-title-${++sheets}`).current;
  const restore = useRef<(() => void) | null>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      restore.current = rememberOpener();
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);
  const closed = () => {
    onClose();
    restore.current?.();
    restore.current = null;
  };
  return (
    <dialog ref={dialog} class="sheet" aria-labelledby={titleId} onClose={closed}>
      <div class="sheet-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      {open && <div class="sheet-body">{children}</div>}
    </dialog>
  );
}

/** Terms and meanings, as a definition list. */
export function Definitions({ items }: { items: { term: string; meaning: string }[] }) {
  return (
    <dl class="defs">
      {items.map((h, i) => (
        <div key={i}>
          <dt>{h.term}</dt>
          <dd>{h.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}
