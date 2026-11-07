import { AFFECT_OPTIONS, copy as resentmentCopy, RESENTMENT_PRAYER, RESENTMENT_STUDY_NOTE } from '../content/resentments';
import { contextFor, fill, type FillContext } from '../content/fill';
import { promptsFor } from '../content/presets';
import type { InventoryDoc } from '../core/doc';
import { progress, type InventoryId, type Step } from '../core/flow';

export interface StepCopy {
  eyebrow: string;
  question: string;
  /** Paragraphs are separated by a blank line. */
  hint: string;
  help?: { term: string; meaning: string }[];
  prompts?: string[];
  options?: { value: string; label: string }[];
  /** List steps: the label on the field that adds an entry. */
  addLabel?: string;
  /** Prayer steps: the prayer itself, with the person's name and the chosen word filled in. */
  prayer?: string;
}

/** The name an entry goes by on screen: a resentment's person, a fear, or whom a harm was to. */
export function entryName(doc: InventoryDoc, step: Pick<Step, 'inventory' | 'entryId'>): string | undefined {
  if (step.entryId === undefined) return undefined;
  const e = (doc[step.inventory] as unknown as Array<Record<string, unknown>>).find((x) => x.id === step.entryId);
  if (!e) return undefined;
  const v = step.inventory === 'resentments' ? e.name : step.inventory === 'fears' ? e.fear : e.who;
  return typeof v === 'string' ? v : undefined;
}

/** What a list step lists, in order. */
export function listEntries(doc: InventoryDoc, inv: InventoryId): { id: string; text: string }[] {
  if (inv === 'resentments') return doc.resentments.map((r) => ({ id: r.id, text: r.name }));
  if (inv === 'fears') return doc.fears.map((f) => ({ id: f.id, text: f.fear }));
  return doc.harms.map((h) => ({ id: h.id, text: h.who }));
}

const DEFECT_QUESTIONS: Record<string, { question: string; label: string; hint: string }> = {
  selfish: { question: 'Where was I selfish?', label: 'Selfish', hint: 'Leave the other person out of it. Where were you wanting things your way?' },
  dishonest: { question: 'Where was I dishonest?', label: 'Dishonest', hint: 'By what you said or did, and by what you left unsaid. Include what you told yourself.' },
  selfSeeking: { question: 'Where was I self-seeking?', label: 'Self-Seeking', hint: 'What did you do, or not do, to get what you wanted or to manage your fear?' },
  frightened: { question: 'Where was I frightened?', label: 'Frightened', hint: 'What were you afraid of: not getting your way, or losing something you have?' },
};

/** Help for a column-4 screen: the quoted page 67 instruction, then the definitions that belong to this defect. */
function defectHelp(label: string, ctx: FillContext): { term: string; meaning: string }[] {
  const col = resentmentCopy.columns['4'];
  const own = (col.help ?? []).filter((h) => h.term === label || h.meaning.startsWith(`${label}:`));
  return [{ term: 'From page 67', meaning: col.hint }, ...own].map((h) => ({ term: fill(h.term, ctx), meaning: fill(h.meaning, ctx) }));
}

function resentmentCopyFor(doc: InventoryDoc, step: Step): StepCopy {
  const ctx = contextFor(doc.settings, entryName(doc, step));
  const cols = resentmentCopy.columns;
  const total = progress(doc, 'resentments').totalColumns;
  const column = (label: string) => `Column ${step.column} of ${total} · ${label}`;

  if (step.key === 'res:intro') {
    return {
      eyebrow: 'Resentments · Before you begin',
      question: 'Before you start the resentment inventory',
      hint: `Pages to study first: ${resentmentCopy.pages}.\n\n${resentmentCopy.instructions}`,
    };
  }
  if (step.key === 'res:study') {
    return {
      eyebrow: column('Before column 4'),
      question: 'Before column 4: study and prayer',
      hint: fill(RESENTMENT_STUDY_NOTE, ctx),
    };
  }
  switch (step.kind) {
    case 'list':
      return {
        eyebrow: column('Who or what'),
        question: cols['1'].heading,
        hint: cols['1'].hint,
        prompts: promptsFor(resentmentCopy.prompts, doc.settings.preset).map((p) => fill(p, ctx)),
        addLabel: 'A person, institution, or principle',
      };
    case 'causes':
      return {
        eyebrow: column(cols['2'].heading.replace(/:$/, '')),
        question: fill('What is your resentment at {name} about?', ctx),
        hint: cols['2'].hint,
        addLabel: 'A cause',
      };
    case 'ticks':
      return {
        eyebrow: column('Affects my…'),
        question: 'What did this affect?',
        hint: `${cols['3'].hint} Tap everything that applies.`,
        help: (cols['3'].help ?? []).map((h) => ({ term: h.term, meaning: fill(h.meaning, ctx) })),
        options: AFFECT_OPTIONS.map((o) => ({ value: o.key, label: o.label })),
      };
    case 'prayer':
      return {
        eyebrow: column('Prayer'),
        question: fill('Say the Resentment Prayer for {name}', ctx),
        hint: 'Say it aloud or silently. You can mark it done, but you do not have to.',
        prayer: fill(RESENTMENT_PRAYER, ctx),
      };
    default: {
      const d = DEFECT_QUESTIONS[step.field ?? ''];
      return {
        eyebrow: column('Core character defects'),
        question: d?.question ?? cols['4'].heading,
        hint: d?.hint ?? cols['4'].hint,
        help: d ? defectHelp(d.label, ctx) : undefined,
      };
    }
  }
}

/** The wording for a step: the single place that maps a step to what the person reads. */
export function stepCopy(doc: InventoryDoc, step: Step): StepCopy {
  // Fears and harms get their wording in the task that builds those screens.
  return resentmentCopyFor(doc, step);
}

/** "Pat: Where was I selfish?", for links to a step from elsewhere. */
export function stepLabel(doc: InventoryDoc, step: Step): string {
  const name = entryName(doc, step);
  const question = stepCopy(doc, step).question;
  return name === undefined ? question : `${name}: ${question}`;
}
