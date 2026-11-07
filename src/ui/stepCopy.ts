import { AFFECT_OPTIONS, copy as resentmentCopy, DEFECT_DEFINITIONS as D, RESENTMENT_PRAYER, RESENTMENT_STUDY_NOTE } from '../content/resentments';
import { copy as fearCopy, FEAR_PRAYER, TRUST_OPTIONS } from '../content/fears';
import { contextFor, fill, type FillContext } from '../content/fill';
import { copy as harmCopy, SEX_MEDITATION, SEX_PRAYER } from '../content/harms';
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
  /** Prayer steps: the label on the box that marks it done. */
  doneLabel?: string;
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

const HARM_DEFECTS: Record<string, string> = { selfish: 'Selfish', dishonest: 'Dishonest', inconsiderate: 'Inconsiderate' };

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

const YES_NO = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];

/** The opening screen of an inventory: the pages to study first, then its instructions. */
function introCopy(title: string, noun: string, content: { pages: string; instructions: string }, ctx: FillContext): StepCopy {
  return {
    eyebrow: `${title} · Before you begin`,
    question: `Before you start the ${noun} inventory`,
    hint: fill(`Pages to study first: ${content.pages}.\n\n${content.instructions}`, ctx),
  };
}

function fearCopyFor(doc: InventoryDoc, step: Step): StepCopy {
  const ctx = contextFor(doc.settings, entryName(doc, step));
  const cols = fearCopy.columns;
  const total = progress(doc, 'fears').totalColumns;
  const column = (label: string) => `Column ${step.column} of ${total} · ${label}`;
  const heading = (n: string) => fill(cols[n].heading, ctx);

  switch (step.kind) {
    case 'intro':
      return introCopy('Fears', 'fear', fearCopy, ctx);
    case 'list':
      return {
        eyebrow: column('Whom or what'),
        question: heading('1'),
        hint: fill(cols['1'].hint, ctx),
        prompts: promptsFor(fearCopy.prompts, doc.settings.preset).map((p) => fill(p, ctx)),
        addLabel: 'A fear',
      };
    case 'text':
      if (step.field === 'why') {
        return { eyebrow: column('Why'), question: heading('2'), hint: 'Say what is behind it, as plainly as you can.' };
      }
      return { eyebrow: column('What would you have me be'), question: heading('6'), hint: fill(cols['6'].hint, ctx) };
    case 'choice':
      if (step.field === 'trust') {
        return {
          eyebrow: column('Trust and reliance'),
          question: heading('3'),
          hint: fill(cols['3'].hint, ctx),
          options: [
            { value: 'god', label: fill(TRUST_OPTIONS.god, ctx) },
            { value: 'self', label: fill(TRUST_OPTIONS.self, ctx) },
          ],
        };
      }
      return { eyebrow: column('Self reliance'), question: heading('4'), hint: cols['4'].hint, options: YES_NO };
    default:
      return {
        eyebrow: column('Prayer'),
        question: 'Say the Fear Prayer',
        hint: 'Say it aloud or silently. You can mark it done, but you do not have to.',
        prayer: fill(FEAR_PRAYER, ctx),
      };
  }
}

function harmCopyFor(doc: InventoryDoc, step: Step): StepCopy {
  const ctx = contextFor(doc.settings, entryName(doc, step));
  const cols = harmCopy.columns;
  const total = progress(doc, 'harms').totalColumns;
  const column = (label: string) => `Column ${step.column} of ${total} · ${label}`;
  const heading = (n: string) => fill(cols[n].heading, ctx);

  switch (step.kind) {
    case 'intro':
      return introCopy('Sex conduct and harms', 'sex conduct and harms', harmCopy, ctx);
    case 'list':
      return {
        eyebrow: column('Whom I hurt'),
        question: heading('1'),
        hint: fill(cols['1'].hint, ctx),
        prompts: promptsFor(harmCopy.prompts, doc.settings.preset).map((p) => fill(p, ctx)),
        addLabel: 'A person or place',
      };
    case 'text': {
      if (step.field === 'fault') {
        return { eyebrow: column('At fault'), question: heading('4'), hint: 'Say what you did, and what you would do now.' };
      }
      const label = HARM_DEFECTS[step.field ?? ''];
      return {
        eyebrow: column('Selfish, dishonest, inconsiderate'),
        question: `Where was I ${label.toLowerCase()}?`,
        hint: fill(label === 'Selfish' ? D.selfish : label === 'Dishonest' ? D.dishonest : D.inconsiderate, ctx),
        help: (cols['2'].help ?? []).map((h) => ({ term: h.term, meaning: fill(h.meaning, ctx) })),
      };
    }
    case 'ticks':
      return {
        eyebrow: column('Arousing'),
        question: 'Did I arouse jealousy, suspicion, or bitterness?',
        hint: 'Tap everything that applies. Leave them all unticked if none do.',
        help: (cols['3'].help ?? []).map((h) => ({ term: h.term, meaning: fill(h.meaning, ctx) })),
        options: [
          { value: 'jealousy', label: 'Jealousy' },
          { value: 'suspicion', label: 'Suspicion' },
          { value: 'bitterness', label: 'Bitterness' },
        ],
      };
    case 'choice':
      return { eyebrow: column('Selfish relation'), question: heading('5'), hint: cols['5'].hint, options: YES_NO };
    default: {
      const meditation = step.field === 'sexMeditationDone';
      return {
        eyebrow: column(meditation ? 'Sex Meditation' : 'Sex Prayer'),
        question: meditation ? 'Say the Sex Meditation' : 'Say the Sex Prayer',
        hint: 'Say it aloud or silently. You can mark it done, but you do not have to.',
        prayer: fill(meditation ? SEX_MEDITATION : SEX_PRAYER, ctx),
        doneLabel: meditation ? "I've said this meditation" : undefined,
      };
    }
  }
}

/** The wording for a step: the single place that maps a step to what the person reads. */
export function stepCopy(doc: InventoryDoc, step: Step): StepCopy {
  if (step.inventory === 'fears') return fearCopyFor(doc, step);
  if (step.inventory === 'harms') return harmCopyFor(doc, step);
  return resentmentCopyFor(doc, step);
}

/** "Pat: Where was I selfish?", for links to a step from elsewhere. */
export function stepLabel(doc: InventoryDoc, step: Step): string {
  const name = entryName(doc, step);
  const question = stepCopy(doc, step).question;
  return name === undefined ? question : `${name}: ${question}`;
}
