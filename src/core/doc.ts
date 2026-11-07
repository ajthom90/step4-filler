export type PresetId = 'food' | 'alcohol' | 'narcotics' | 'sexLove' | 'general';
export type YesNo = 'yes' | 'no' | null;
export interface GodWord { kind: 'god' | 'higherPower' | 'custom'; custom: string }
export interface Affects { selfEsteem: boolean; security: boolean; ambitions: boolean; personalRelations: boolean; sexRelations: boolean; fear: boolean }
export interface Cause { id: string; text: string; affects: Affects }
export interface ResentmentEntry { id: string; name: string; causes: Cause[]; prayerDone: boolean; selfish: string; dishonest: string; selfSeeking: string; frightened: string }
export interface FearEntry { id: string; fear: string; why: string; trust: 'god' | 'self' | null; selfRelianceWorked: YesNo; prayerDone: boolean; beWhat: string }
export interface HarmEntry { id: string; who: string; selfish: string; dishonest: string; inconsiderate: string; jealousy: boolean; suspicion: boolean; bitterness: boolean; fault: string; wasSelfish: YesNo; sexPrayerDone: boolean; sexMeditationDone: boolean }
export interface InventoryDoc {
  format: 'step4-inventory'; version: 1;
  settings: { preset: PresetId; godWord: GodWord };
  visited: Record<string, true>;
  resentments: ResentmentEntry[]; fears: FearEntry[]; harms: HarmEntry[];
  checklist: { selected: string[]; other: string };
  pledge: { listA: string[]; listB: string[]; name: string; date: string };
}

export function emptyDoc(preset: PresetId, godWord: GodWord): InventoryDoc {
  return {
    format: 'step4-inventory',
    version: 1,
    settings: { preset, godWord: { kind: godWord.kind, custom: godWord.custom } },
    visited: {},
    resentments: [],
    fears: [],
    harms: [],
    checklist: { selected: [], other: '' },
    pledge: { listA: [], listB: [], name: '', date: '' },
  };
}

/** 128 random bits as 32 lowercase hex characters. */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}
