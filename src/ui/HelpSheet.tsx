import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

/**
 * A modal sheet over the current step. It is a native dialog, so focus stays inside it,
 * Escape closes it, and focus returns to the button that opened it. The step underneath
 * stays mounted, so nothing typed there is lost.
 */
let sheets = 0;

export function HelpSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ComponentChildren }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Several sheets can be on one screen, so each names its own title.
  const titleId = useRef(`sheet-title-${++sheets}`).current;
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={dialog} class="sheet" aria-labelledby={titleId} onClose={onClose}>
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
