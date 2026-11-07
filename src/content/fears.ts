import type { Prompt } from './presets';

/** Handout pp. 8-10. */

export const FEAR_PRAYER = '{god}, please remove my fear and direct my attention to what you would have me be';

/** Column 3 choices. The first is filled with the person's word for God. */
export const TRUST_OPTIONS = { god: 'Infinite {god}', self: 'My Finite Self' } as const;

/** Column 5 tick-box label on the form. */
export const FEAR_PRAYER_DONE_LABEL = 'Completed fear prayer?';

export const copy: {
  title: string; instructions: string; pages: string;
  columns: Record<string, { heading: string; hint: string; help?: { term: string; meaning: string }[] }>;
  prompts: Prompt[];
} = {
  title: 'Fears',
  pages: 'pages 67 and 68',
  instructions:
    'a) Study from the bottom of page 67 to the bottom of page 68 in the book Alcoholics Anonymous. ' +
    'b) Complete column 1 (listing whom or what I am fearful of), from top to bottom. ' +
    'c) Complete the remaining columns from top to bottom for each fear in column 1. ' +
    'Remember that "we are now on a different basis; the basis of trusting and relying upon God. We trust infinite God rather than our finite selves. . . . ' +
    'Just to the extent that we do as we think He would have us, and humbly rely on Him, does He enable us to match calamity with serenity" (page 68).',
  columns: {
    '1': { heading: "I'm fearful of:", hint: 'List whom or what you are fearful of. The list on the next screen may help.' },
    '2': { heading: 'Why do I have the fear?', hint: '' },
    '3': { heading: 'Where was my trust & reliance?', hint: 'Infinite {god} or My Finite Self' },
    '4': { heading: 'Did self reliance work?', hint: 'Yes or No' },
    '5': { heading: 'Fear Prayer', hint: FEAR_PRAYER },
    '6': { heading: 'What would {god} have you be?', hint: 'Write out your answer to that question for each and every fear listed.' },
  },
  // The handout's "A Partial Fear List", in its order, left column then right column.
  prompts: [
    { text: 'Fear of {behavior}' }, { text: 'Fear of insanity' }, { text: 'Fear of life' }, { text: 'Fear of injury' },
    { text: 'Fear of blindness' }, { text: 'Fear of deafness' }, { text: 'Fear of death' }, { text: 'Fear of cancer' },
    { text: 'Fear of dentists' }, { text: 'Fear of doctors' }, { text: 'Fear of hospitalization' }, { text: 'Fear of pain' },
    { text: 'Fear of psychiatrists' }, { text: 'Fear of Step 3' }, { text: 'Fear of Step 4' }, { text: 'Fear of Step 5' },
    { text: 'Fear of Step 9' }, { text: 'Fear of Loss of Love' }, { text: 'Fear of Loss of spouse, partner' },
    { text: 'Fear of detachment' }, { text: 'Fear of rejection' }, { text: 'Fear of criticism' }, { text: 'Fear of loneliness' },
    { text: 'Fear of crowds' }, { text: 'Fear of public speaking' }, { text: 'Fear of flying' }, { text: 'Fear of the dark' },
    { text: 'Fear of heights' }, { text: 'Fear of fire' }, { text: 'Fear of being fired' }, { text: 'Fear of being laid off' },
    { text: 'Fear of financial insecurity' }, { text: 'Fear of old age' }, { text: 'Fear of sorrow' },
    { text: 'Fear of "IF YOU KNEW THIS ABOUT Me"' }, { text: 'Fear of animals, dogs, cats' },
    { text: 'Fear of being broke' }, { text: 'Fear of losing car, house, "stuff"' }, { text: 'Fear of losing spouse, friend' },
    { text: 'Fear of failure (SUCCESS)' }, { text: 'Fear of poverty' }, { text: 'Fear of money' }, { text: 'Fear of wealth' },
    { text: 'Fear of law' }, { text: 'Fear of court' }, { text: 'Fear of police' }, { text: 'Fear of jail' },
    { text: 'Fear of Income Tax People' }, { text: 'Fear of Making Direct Amends' }, { text: 'Fear of Surgery' },
    { text: 'Fear of sex (INTIMACY)' }, { text: 'Fear of Love' }, { text: 'Fear of FEAR' }, { text: 'Fear of impotency' },
    { text: 'Fear of commitment' }, { text: 'Fear of sponsor' }, { text: 'Fear of {fellowship}' }, { text: 'Fear of {god}' },
    { text: 'Fear of churches' }, { text: 'Fear of candle-light meetings' }, { text: 'Fear of confined spaces' },
    { text: 'Fear of eye to eye contact' }, { text: 'Fear of "burning in hell"' }, { text: 'Fear of "the realm of the spirit"' },
    { text: 'Fear of psychic experiences' }, { text: 'Fear of water' }, { text: 'Fear of snakes' },
    { text: 'Fear of BEING CAUGHT at ANYTHING' },
    // Drafted for the presets, not from the handout.
    { text: 'Fear of gaining weight', only: ['food'] },
    { text: 'Fear of food', only: ['food'] },
    { text: 'Fear of withdrawal', only: ['narcotics'] },
    { text: 'Fear of overdose', only: ['narcotics'] },
    { text: 'Fear of abandonment', only: ['sexLove'] },
    { text: 'Fear of being found out', only: ['sexLove'] },
  ],
};

/** Wording written for the fear screens (not taken from the handout). */
export const screens = {
  intro: { eyebrow: 'Fears · Before you begin', question: 'Before you start the fear inventory' },
  list: { eyebrow: 'Whom or what', addLabel: 'A fear' },
  why: { eyebrow: 'Why', hint: 'Say what is behind it, as plainly as you can.' },
  trust: { eyebrow: 'Trust and reliance' },
  worked: { eyebrow: 'Self reliance' },
  prayer: { eyebrow: 'Prayer', question: 'Say the Fear Prayer' },
  be: { eyebrow: 'What would you have me be' },
} as const;
