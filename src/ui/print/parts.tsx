import type { ComponentChildren } from 'preact';
import { DISCLAIMER, saveCopy } from '../../content/copy';

const p = saveCopy.print;

/** A box on a form: empty, or marked with an X. The label is for screen readers; the X is what prints. */
export function Tick({ on }: { on: boolean }) {
  return <span class="box" role="img" aria-label={on ? p.ticked : p.notTicked}>{on ? 'X' : ''}</span>;
}

/** A person's own words, shown as text and kept as typed, line breaks included. */
export function Val({ text }: { text: string }) {
  return <div class="val">{text}</div>;
}

/** The entries to print: the real ones, then empty ones up to `min`, as a blank paper form has. */
export function padTo<T>(items: T[], min: number): (T | null)[] {
  return [...items, ...Array.from({ length: Math.max(0, min - items.length) }, () => null)];
}

/** One form, with its title. `landscape` gives it a landscape page when printed. */
export function FormSection({ id, title, landscape, children }: { id: string; title: string; landscape: boolean; children: ComponentChildren }) {
  return (
    <section class={landscape ? 'print-section land' : 'print-section'} aria-labelledby={id}>
      <h2 id={id} class="form-title">{title}</h2>
      {children}
    </section>
  );
}

/** Wide tables scroll inside this on screen, and the keyboard can reach it. When printed it is just the table. */
export function Scroll({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="scroll" role="region" tabIndex={0} aria-label={label}>
      {children}
    </div>
  );
}

/**
 * The disclaimer, as the table's footer row. When printed, a table footer repeats under the rows on every
 * page the table fills, in portrait and landscape alike. On screen it is not shown, because the site
 * footer already says it.
 */
export function Foot({ cols }: { cols: number }) {
  return (
    <tfoot class="foot">
      <tr><td colSpan={cols}>{DISCLAIMER}</td></tr>
    </tfoot>
  );
}
