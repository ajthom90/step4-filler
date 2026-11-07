import { DEFECT_DEFINITIONS as D } from './resentments';
import type { Prompt } from './presets';

/** Handout pp. 11-13. */

export const SEX_PRAYER = '{god}, please mold my ideals and help me to live up to them';
export const SEX_MEDITATION = '{god}, please show me what to do about this [each] specific matter';

/** The Earnest Prayers, Big Book p. 70, as printed on the handout. Verbatim, so no tokens. */
export const EARNEST_PRAYERS: { intro: string; items: string[]; closing: string[] } = {
  intro: 'We earnestly pray for:',
  items: ['The right ideal', 'Guidance in each questionable situation', 'Sanity', 'The strength to do the right thing'],
  closing: [
    'If sex is troublesome, we throw ourselves the harder into helping others.',
    'We think of their needs and work for them.',
    'This takes us out of ourselves.',
    'It quiets the imperious urge, when to yield would mean heartache.',
  ],
};

export const copy: {
  title: string; instructions: string; pages: string;
  columns: Record<string, { heading: string; hint: string; help?: { term: string; meaning: string }[] }>;
  prompts: Prompt[];
} = {
  title: 'Sex conduct and harms',
  pages: 'pages 68 to 70',
  instructions:
    'a) Study from the bottom of page 68 to the end of third paragraph on page 70. ' +
    'b) Fill in Column 1 from top to bottom. ' +
    'c) Do Column 2 from top to bottom. ' +
    'd) Fill in each of the remaining columns from top to bottom. ' +
    'Do not work across the page from left to right. ' +
    'Don\'t forget the Sex Prayer ("God, please mold my ideals and help me to live up to them") on page 69, and the Big Book\'s Sex Meditation ("God, please show me what to do about this [each] specific matter") on page 69. ' +
    '"The right answer will come if we want it". This will shape a "sane and sound ideal for our future sex life" (page 69). ' +
    'Be sure to restudy what happens if we "fall short of the chosen ideal and stumble" on page 70. ' +
    'Be sure to continue to pray the "Earnest" prayers from page 70 (on the right hand side of this page) for ongoing guidance, strength, sanity, and the right ideal.',
  columns: {
    '1': {
      heading: 'Whom did I hurt?',
      hint: 'Anyone that you think they had it coming or if you feel they deserved what they got (from you) then they should probably be on here.',
    },
    '2': {
      heading: 'Where was I',
      hint: 'Selfish, Dishonest and Inconsiderate',
      help: [
        { term: 'Selfish', meaning: D.selfish },
        { term: 'Dishonest', meaning: D.dishonest },
        { term: 'Inconsiderate', meaning: D.inconsiderate },
        { term: 'Pride', meaning: D.pride },
      ],
    },
    '3': {
      heading: 'Did I arouse:',
      hint: 'Jealousy, Suspicion or Bitterness',
      help: [{ term: 'Suspicion', meaning: D.suspicion }],
    },
    '4': { heading: 'Where was I at fault, what should I have done instead?', hint: '' },
    '5': { heading: 'Was each relation selfish?', hint: 'Yes or No' },
    '6': { heading: 'Sex Prayer', hint: SEX_PRAYER },
    '7': { heading: 'Sex Meditation', hint: SEX_MEDITATION },
  },
  // "Places to look for any harms done including sex", Relations with: left column then right column.
  prompts: [
    { text: 'Teachers' }, { text: 'Treatment centers' }, { text: 'Parents' }, { text: 'Counselors' }, { text: 'Siblings' },
    { text: "Other people's or company's property (anything you don't personally own.)" },
    { text: 'Family' }, { text: 'People in your 12 step group' }, { text: 'Current Spouse/Domestic Partner' },
    { text: 'Mistress, Man or Woman "on the side"' }, { text: 'Business Partners' }, { text: 'Your Sponsor' },
    { text: 'Police Officers' }, { text: 'Your sponsee' }, { text: 'Judges' }, { text: 'Your Church/Clergy' },
    { text: 'Ex-wives, ex-husbands, ex-partners' }, { text: 'Your school/university/college' }, { text: 'Banking Institutions' },
    { text: 'Your grocery store/local bakery/bar', only: ['alcohol', 'general'] },
    { text: 'Your grocery store/local bakery', only: ['food', 'narcotics', 'sexLove'] },
    { text: 'Employers' }, { text: 'Neighbors' }, { text: 'Employees' }, { text: 'Governments, local & greater' },
    { text: 'Co-workers' }, { text: 'Sex partners' }, { text: 'Anyone in your workplace' },
    { text: 'Restaurants/coffee shops/hangouts' }, { text: 'Your children' }, { text: 'Hired help/contractors' },
    { text: "Other people's children" }, { text: 'Insurance companies' }, { text: "Your children's school" },
    { text: "Anyone or institution who's ever been in a position of authority over you." },
    { text: 'PTA, other organizations' }, { text: 'Drivers of other cars' },
    { text: "Anyone or institution you've ever had authority over for any period of time." },
    { text: 'Passengers in your car' }, { text: 'Correctional facilities (jail, prison, etc..)' }, { text: 'Political Involvement' },
    { text: 'Nieces, nephews, aunts & uncles' },
    { text: 'Unpaid debts, personal business interactions (i.e. your insurance agent, banker, etc...)' },
    // Drafted for the presets, not from the handout.
    { text: 'People I lied to about {behavior}' },
  ],
};

/** Column 3 choices. */
export const AROUSE_OPTIONS = [
  { key: 'jealousy', label: 'Jealousy' },
  { key: 'suspicion', label: 'Suspicion' },
  { key: 'bitterness', label: 'Bitterness' },
] as const;

/** Wording written for the sex conduct and harms screens (not taken from the handout). */
export const screens = {
  intro: { eyebrow: 'Sex conduct and harms · Before you begin', question: 'Before you start the sex conduct and harms inventory' },
  list: { eyebrow: 'Whom I hurt', addLabel: 'A person or place' },
  where: {
    eyebrow: 'Selfish, dishonest, inconsiderate',
    selfish: { question: 'Where was I selfish?', hint: D.selfish },
    dishonest: { question: 'Where was I dishonest?', hint: D.dishonest },
    inconsiderate: { question: 'Where was I inconsiderate?', hint: D.inconsiderate },
  },
  arouse: {
    eyebrow: 'Arousing',
    question: 'Did I arouse jealousy, suspicion, or bitterness?',
    hint: 'Tap everything that applies. Leave them all unticked if none do.',
  },
  fault: { eyebrow: 'At fault', hint: 'Say what you did, and what you would do now.' },
  relation: { eyebrow: 'Selfish relation' },
  sexPrayer: { eyebrow: 'Sex Prayer', question: 'Say the Sex Prayer' },
  meditation: { eyebrow: 'Sex Meditation', question: 'Say the Sex Meditation', doneLabel: "I've said this meditation" },
  earnest: { button: 'Earnest prayers (page 70)', title: 'Earnest prayers' },
} as const;
