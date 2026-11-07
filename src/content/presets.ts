import type { PresetId } from '../core/doc';

export interface Preset {
  id: PresetId;
  label: string;
  /** True when the wording was drafted by the builder and has not been reviewed by a member of that fellowship. */
  draft: boolean;
  behavior: string;
  fellowship: string;
  pledgeListA: string;
  pledgeListB: string;
  pledgeText: string;
}

const OTHER_LISTS = { pledgeListA: "What I'm abstaining from", pledgeListB: "Behaviors I'm abstaining from", pledgeText: 'I pledge to abstain absolutely from the above.' };

export const PRESETS: Record<PresetId, Preset> = {
  food: {
    id: 'food', label: 'Food', draft: false, behavior: 'compulsive eating', fellowship: 'OA',
    pledgeListA: 'Binge foods', pledgeListB: 'Compulsive food behaviors',
    pledgeText: 'I pledge to abstain absolutely from the above binge foods and compulsive food behaviors.',
  },
  alcohol: { id: 'alcohol', label: 'Alcohol', draft: false, behavior: 'drinking', fellowship: 'AA', ...OTHER_LISTS },
  narcotics: { id: 'narcotics', label: 'Narcotics', draft: true, behavior: 'using', fellowship: 'NA', ...OTHER_LISTS },
  sexLove: { id: 'sexLove', label: 'Sex and love', draft: true, behavior: 'acting out', fellowship: 'my fellowship', ...OTHER_LISTS },
  general: { id: 'general', label: 'Other / general', draft: false, behavior: 'my addiction', fellowship: 'my fellowship', ...OTHER_LISTS },
};

/** A suggestion for a list. With `only`, it is offered to those presets alone. */
export interface Prompt { text: string; only?: PresetId[] }

/** The prompt texts that apply to a preset, still containing their `{tokens}`. */
export function promptsFor(list: Prompt[], preset: PresetId): string[] {
  return list.filter((p) => !p.only || p.only.includes(preset)).map((p) => p.text);
}
