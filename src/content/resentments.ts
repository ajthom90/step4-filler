import type { Affects } from '../core/doc';
import type { Prompt } from './presets';

/** Handout pp. 2-7. `{god}`, `{name}`, `{behavior}` and `{fellowship}` are filled in by fill(). */

export const RESENTMENT_PRAYER = '{god}, please help me show {name} the same tolerance, pity and patience I would cheerfully grant a sick friend';

/** The p. 2 note shown before column 4, with the handout's blanks. Not tied to one person. */
export const RESENTMENT_STUDY_NOTE =
  'Study from the bottom of page 65 to the end of the 3rd paragraph on page 67, and then follow the instructions. ' +
  'Go to each person who has harmed you or someone else and say "_______ is spiritually sick." ' +
  'Don\'t forget to say the Resentment Prayer (Lines 3-5, page 67), "{god}, please help me show ________ the same tolerance, pity and patience I would cheerfully grant a sick friend" ' +
  'for each and every person who has harmed you, themselves or someone else in Column 1 prior to starting Column 4.';

/** Column 3 choices, in handout order, with the label the form uses. */
export const AFFECT_OPTIONS: { key: keyof Affects; label: string }[] = [
  { key: 'selfEsteem', label: 'Self-Esteem' },
  { key: 'security', label: 'Security (Pocketbooks)' },
  { key: 'ambitions', label: 'Ambitions' },
  { key: 'personalRelations', label: 'Personal Relations' },
  { key: 'sexRelations', label: 'Sex Relations' },
  { key: 'fear', label: 'Is any fear involved?' },
];

/** Shared by the harms inventory for its "Where was I" column. Handout pp. 5. */
export const DEFECT_DEFINITIONS = {
  selfish: 'Wanting things my way while disregarding the welfare or wishes of others. Wanting a person to act in another way or to be something other than what he or she is/was.',
  dishonest: "By Commission – telling/acting on lies or by denial. By Omission – What I didn't say. Information I did not provide. Did I say what I needed, how I felt or thought? Have I been honest with myself?",
  selfSeeking: 'What did I do (or not do) to get what I want to make myself feel better, or to manage my fear? Do you interact with people using a "hidden agenda"?',
  frightened: 'Fear of not getting my way or losing what I have. May result from reliance upon people, places and things instead of having faith in {god}.',
  inconsiderate: 'Lack of consideration about how another person felt, their wants, their needs, their beliefs or how I affected them',
  pride: 'Thinking too much or too little of oneself',
  suspicion: 'Doubt or mistrust based on little or no evidence',
} as const;

/** p. 6, "Dishonest: What lies did I tell myself?" and "What is the truth?". */
export const LIES_AND_TRUTHS: { lie: string; truth: string }[] = [
  { lie: 'I am less than or better than', truth: "We're all equal in {god}'s eyes" },
  { lie: 'My expectations are reasonable', truth: 'Unrealistic expectations (they may not be capable of giving it)' },
  { lie: "It's all my responsibility OR I have to", truth: "It's not their responsibility to give me what I need or want" },
  { lie: "It's my business/concern", truth: "It's none of my business" },
  { lie: "I'm supposed to control this/them", truth: 'I have/had no control' },
  { lie: "I'm pretending I don't care", truth: 'I do care' },
  { lie: "I'm not speaking up OR I'm not expressing my needs, wants, fears", truth: "I'm hurting myself with my silence" },
  { lie: "I'm at fault OR I'm to blame OR I'm defective", truth: "I'm failing to appreciate my good qualities" },
  { lie: "It's okay for others to treat me that way/poorly", truth: 'I teach people how to treat me (by accepting unacceptable behavior)' },
  { lie: "I'm right OR I know the future or People should do or think like me", truth: 'Other people have a right to their agenda' },
  { lie: 'She/he is horrible', truth: "I've done it too" },
  { lie: 'It is about me (taking things personally)', truth: "It's more about them and their history than it is about me" },
  { lie: 'They are/were my source', truth: '{god} is my source' },
  { lie: 'I had/have to let these people into my life', truth: "I didn't have to let them in my life the way I did" },
  { lie: 'This situation/person was forced upon me', truth: 'I took it on' },
  { lie: "I had no part OR I'm a victim", truth: 'I set myself up for it' },
  { lie: 'I can read minds OR I know what they are thinking/feeling', truth: "I can't control others' thoughts, feelings or opinions" },
];

/** p. 6, "Self-Seeking: What did I do (or not do) to get what I want ...". */
export const SELF_SEEKING_SUGGESTIONS: string[] = [
  'Gossip', 'Manipulate people to side with me',
  'Blame them for what I do or believe', 'Blame myself OR beat myself up',
  'Obsess OR increase self-pity by replaying it in my mind', 'Withdraw or isolate',
  'Did anything people wanted so they would like me', 'Nurture jealousy',
  'Silent scorn', 'Telling someone to do something',
  'People please by not speaking up', 'Arousing bitterness',
  "Throw things up in people's faces", 'Tried harder or pushed or repeated',
  'Condemn or criticize (to shift focus to them)', 'Judge him/her',
  'Justify or rationalize', 'Compare',
];

/** p. 6, "Frightened/Afraid: what was I afraid of?". */
export const FEAR_SUGGESTIONS: string[] = [
  'Rejection', 'Being alone or abandonment',
  'Not being good enough', 'Losing control or having no control',
  'Losing what I have', 'Not getting what I want',
  'Not having enough money (finances)', 'Physical harm',
  "Others' opinions", 'Confrontation',
  'Not being loved', 'Being hurt',
  'Being taken advantage of',
];

const D = DEFECT_DEFINITIONS;

export const copy: {
  title: string; instructions: string; pages: string;
  columns: Record<string, { heading: string; hint: string; help?: { term: string; meaning: string }[] }>;
  prompts: Prompt[];
} = {
  title: 'Resentments',
  pages: 'pages 63 to 67',
  instructions:
    'Study from the bottom of page 63 to the end of page 65 and then follow its instructions: ' +
    'a) List all people, institutions and principles (Column 1) from top to bottom. ' +
    'b) List all "causes" (Column 2), top to bottom. ' +
    'c) Do all six instincts in Column 3 from top to bottom for each "cause". ' +
    'd) Consider the first three columns carefully. ' +
    'e) Then, complete Column 4 from top to bottom.',
  columns: {
    '1': {
      heading: "I'm resentful at:",
      hint: 'Areas to look for resentments (more than just an annoyance). Resentment means to re-feel the anger long after the event has passed.',
    },
    '2': { heading: 'The causes:', hint: 'List all the causes for each one.' },
    '3': {
      heading: 'Affects my:',
      hint: 'Do all six for each cause.',
      help: [
        { term: 'Self-Esteem', meaning: 'What I think of myself (high or low) and how I think others think of me.' },
        {
          term: 'Security',
          meaning:
            'Not feeling SAFE. Financial: "Pocketbooks": money, property, etc. ' +
            'Personal: Exposure of physical well-being to danger or harm – real or imagined. ' +
            'Emotional: Exposure to feelings of apprehension or doubt – feeling not safe.',
        },
        { term: 'Ambitions', meaning: '"What I want out of life"; my plans or dreams' },
        { term: 'Personal Relations', meaning: 'Our relations with other people (other than the resented person) and the world around us' },
        { term: 'Sex Relations', meaning: 'Our sex lives' },
        { term: 'Is any fear involved?', meaning: 'A feeling of anxiety/apprehension that I may not get what I want or I may lose what I have (including approval from others)' },
      ],
    },
    '4': {
      heading: 'Core Character Defects',
      hint:
        '"Putting out of our minds the wrongs others have done, we resolutely looked for our own mistakes. ' +
        'Where had we been selfish, dishonest, self-seeking and frightened? . . . [D]isregard the other person involved entirely. ' +
        'Where were we to blame? . . . When we saw our faults we listed them. We placed them before us in black and white. ' +
        'We admitted our wrongs honestly and were willing to set these matters straight." (page 67)',
      help: [
        { term: 'Selfish', meaning: D.selfish },
        { term: 'Dishonest', meaning: D.dishonest },
        { term: 'Self-Seeking', meaning: D.selfSeeking },
        { term: 'Frightened', meaning: D.frightened },
        { term: 'Inconsiderate', meaning: D.inconsiderate },
        { term: 'Pride', meaning: D.pride },
        { term: 'Suspicion', meaning: D.suspicion },
        ...LIES_AND_TRUTHS.map((l) => ({ term: l.lie, meaning: `Dishonest: a lie I may tell myself. The truth: ${l.truth}` })),
        ...SELF_SEEKING_SUGGESTIONS.map((s) => ({ term: s, meaning: 'Self-Seeking: something I may have done' })),
        ...FEAR_SUGGESTIONS.map((s) => ({ term: s, meaning: 'Frightened: something I may have been afraid of' })),
      ],
    },
  },
  prompts: [
    { text: 'Lawyers' }, { text: 'Court System' }, { text: 'Police departments' }, { text: 'Police officers' },
    { text: 'Jailers' }, { text: 'Tax laws' }, { text: 'Bill Collectors' }, { text: 'People who gossip' },
    { text: 'People that died' },
    { text: 'People at bars', only: ['alcohol', 'general'] },
    { text: 'Family rules' }, { text: "Society's rules" }, { text: 'People that try to tell me what to do' },
    { text: 'Friends' }, { text: 'Your spouse' }, { text: "Someone else's spouse" }, { text: 'DNR' },
    { text: 'Oil companies' }, { text: 'Politics' }, { text: 'People in politics' }, { text: 'Political views and ideals' },
    { text: 'Bad drivers' }, { text: 'Predators' }, { text: 'Thieves' }, { text: 'Con artists' },
    { text: 'Bad business practices' }, { text: 'Insurance companies' }, { text: 'Policies' },
    { text: 'People with money' }, { text: 'People without money' }, { text: 'Panhandlers' }, { text: 'Churches' },
    { text: '{god}' },
    { text: 'Religious people' }, { text: 'Bosses past and present' }, { text: 'Coworkers' }, { text: 'Nurses' },
    { text: 'Dentists' }, { text: 'Telephone marketers' }, { text: 'Government' }, { text: 'Government workers' },
    { text: 'Government policies' }, { text: 'Government ideals' }, { text: 'Baby sitters' },
    { text: 'Childhood friends' }, { text: 'Childhood enemies' }, { text: 'Teachers' }, { text: 'Neighbors' },
    { text: 'Bullies' }, { text: 'Parents' }, { text: 'Siblings' }, { text: 'Relatives' },
    { text: 'People from 12 step groups' }, { text: 'Sponsors' }, { text: 'Grandiose people' },
    { text: 'Boyfriends past or present' }, { text: 'Girlfriends past or present' }, { text: 'Psychiatrists' },
    { text: 'Companies you worked for' }, { text: 'Getting older' }, { text: "Children yours or someone else's" },
    { text: 'Sales people' }, { text: 'Diseases that kill or change people' },
    { text: 'Casinos', only: ['alcohol', 'narcotics', 'sexLove', 'general'] },
    { text: 'Addictions' }, { text: 'People that disappoint us' }, { text: 'Utility companies' },
    { text: 'Companies that rip us off' }, { text: 'People of other races' }, { text: 'Racists' },
    { text: 'People with different views' }, { text: 'Doctors' },
    // Drafted for the presets, not from the handout.
    { text: 'People who comment on my weight or what I eat', only: ['food'] },
    { text: 'Diets and diet culture', only: ['food'] },
    { text: 'People who drank with me', only: ['alcohol'] },
    { text: 'People I used with', only: ['narcotics'] },
    { text: 'People who supplied me', only: ['narcotics'] },
    { text: 'People who ended a relationship with me', only: ['sexLove'] },
  ],
};
