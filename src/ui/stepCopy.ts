import { AFFECT_OPTIONS, copy as resentmentCopy, PAGES_LEAD, PRAYER_HINT, RESENTMENT_PRAYER, RESENTMENT_STUDY_NOTE, screens as resentmentScreens } from '../content/resentments';
import { copy as fearCopy, FEAR_PRAYER, screens as fearScreens, TRUST_OPTIONS } from '../content/fears';
import { contextFor, fill, type FillContext } from '../content/fill';
import { AROUSE_OPTIONS, copy as harmCopy, SEX_MEDITATION, SEX_PRAYER, screens as harmScreens } from '../content/harms';
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

const RES = resentmentScreens;

/** Help for a column-4 screen: the quoted page 67 instruction, then the definitions that belong to this defect. */
function defectHelp(label: string, ctx: FillContext): { term: string; meaning: string }[] {
  const col = resentmentCopy.columns['4'];
  const own = (col.help ?? []).filter((h) => h.term === label || h.meaning.startsWith(`${label}:`));
  return [{ term: RES.defects.helpTerm, meaning: col.hint }, ...own].map((h) => ({ term: fill(h.term, ctx), meaning: fill(h.meaning, ctx) }));
}

function resentmentCopyFor(doc: InventoryDoc, step: Step): StepCopy {
  const ctx = contextFor(doc.settings, entryName(doc, step));
  const cols = resentmentCopy.columns;
  const total = progress(doc, 'resentments').totalColumns;
  const column = (label: string) => `Column ${step.column} of ${total} · ${label}`;

  if (step.key === 'res:intro') {
    return {
      ...RES.intro,
      hint: `${PAGES_LEAD} ${resentmentCopy.pages}.\n\n${resentmentCopy.instructions}`,
    };
  }
  if (step.key === 'res:study') {
    return {
      eyebrow: column(RES.study.eyebrow),
      question: RES.study.question,
      hint: fill(RESENTMENT_STUDY_NOTE, ctx),
    };
  }
  switch (step.kind) {
    case 'list':
      return {
        eyebrow: column(RES.list.eyebrow),
        question: cols['1'].heading,
        hint: cols['1'].hint,
        prompts: promptsFor(resentmentCopy.prompts, doc.settings.preset).map((p) => fill(p, ctx)),
        addLabel: RES.list.addLabel,
      };
    case 'causes':
      return {
        eyebrow: column(cols['2'].heading.replace(/:$/, '')),
        question: fill(RES.causes.question, ctx),
        hint: cols['2'].hint,
        addLabel: RES.causes.addLabel,
      };
    case 'ticks':
      return {
        eyebrow: column(RES.ticks.eyebrow),
        question: RES.ticks.question,
        hint: `${cols['3'].hint}${RES.ticks.hintSuffix}`,
        help: (cols['3'].help ?? []).map((h) => ({ term: h.term, meaning: fill(h.meaning, ctx) })),
        options: AFFECT_OPTIONS.map((o) => ({ value: o.key, label: o.label })),
      };
    case 'prayer':
      return {
        eyebrow: column(RES.prayer.eyebrow),
        question: fill(RES.prayer.question, ctx),
        hint: PRAYER_HINT,
        prayer: fill(RESENTMENT_PRAYER, ctx),
      };
    default: {
      const d = RES.defects[(step.field ?? '') as 'selfish'] as (typeof RES.defects)['selfish'] | undefined;
      return {
        eyebrow: column(RES.defects.eyebrow),
        question: d?.question ?? cols['4'].heading,
        hint: d?.hint ?? cols['4'].hint,
        help: d ? defectHelp(d.label, ctx) : undefined,
      };
    }
  }
}

const YES_NO = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];

/** The opening screen of an inventory: the pages to study first, then its instructions. */
function introCopy(screen: { eyebrow: string; question: string }, content: { pages: string; instructions: string }, ctx: FillContext): StepCopy {
  return {
    ...screen,
    hint: fill(`${PAGES_LEAD} ${content.pages}.\n\n${content.instructions}`, ctx),
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
      return introCopy(fearScreens.intro, fearCopy, ctx);
    case 'list':
      return {
        eyebrow: column(fearScreens.list.eyebrow),
        question: heading('1'),
        hint: fill(cols['1'].hint, ctx),
        prompts: promptsFor(fearCopy.prompts, doc.settings.preset).map((p) => fill(p, ctx)),
        addLabel: fearScreens.list.addLabel,
      };
    case 'text':
      if (step.field === 'why') {
        return { eyebrow: column(fearScreens.why.eyebrow), question: heading('2'), hint: fearScreens.why.hint };
      }
      return { eyebrow: column(fearScreens.be.eyebrow), question: heading('6'), hint: fill(cols['6'].hint, ctx) };
    case 'choice':
      if (step.field === 'trust') {
        return {
          eyebrow: column(fearScreens.trust.eyebrow),
          question: heading('3'),
          hint: fill(cols['3'].hint, ctx),
          options: [
            { value: 'god', label: fill(TRUST_OPTIONS.god, ctx) },
            { value: 'self', label: fill(TRUST_OPTIONS.self, ctx) },
          ],
        };
      }
      return { eyebrow: column(fearScreens.worked.eyebrow), question: heading('4'), hint: cols['4'].hint, options: YES_NO };
    default:
      return {
        eyebrow: column(fearScreens.prayer.eyebrow),
        question: fearScreens.prayer.question,
        hint: PRAYER_HINT,
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
      return introCopy(harmScreens.intro, harmCopy, ctx);
    case 'list':
      return {
        eyebrow: column(harmScreens.list.eyebrow),
        question: heading('1'),
        hint: fill(cols['1'].hint, ctx),
        prompts: promptsFor(harmCopy.prompts, doc.settings.preset).map((p) => fill(p, ctx)),
        addLabel: harmScreens.list.addLabel,
      };
    case 'text': {
      if (step.field === 'fault') {
        return { eyebrow: column(harmScreens.fault.eyebrow), question: heading('4'), hint: harmScreens.fault.hint };
      }
      const d = harmScreens.where[(step.field ?? '') as 'selfish'];
      return {
        eyebrow: column(harmScreens.where.eyebrow),
        question: d.question,
        hint: fill(d.hint, ctx),
        help: (cols['2'].help ?? []).map((h) => ({ term: h.term, meaning: fill(h.meaning, ctx) })),
      };
    }
    case 'ticks':
      return {
        eyebrow: column(harmScreens.arouse.eyebrow),
        question: harmScreens.arouse.question,
        hint: harmScreens.arouse.hint,
        help: (cols['3'].help ?? []).map((h) => ({ term: h.term, meaning: fill(h.meaning, ctx) })),
        options: AROUSE_OPTIONS.map((o) => ({ value: o.key, label: o.label })),
      };
    case 'choice':
      return { eyebrow: column(harmScreens.relation.eyebrow), question: heading('5'), hint: cols['5'].hint, options: YES_NO };
    default: {
      const meditation = step.field === 'sexMeditationDone';
      const screen = meditation ? harmScreens.meditation : harmScreens.sexPrayer;
      return {
        eyebrow: column(screen.eyebrow),
        question: screen.question,
        hint: PRAYER_HINT,
        prayer: fill(meditation ? SEX_MEDITATION : SEX_PRAYER, ctx),
        doneLabel: meditation ? harmScreens.meditation.doneLabel : undefined,
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
