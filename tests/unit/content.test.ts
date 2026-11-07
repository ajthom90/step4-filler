import { describe, expect, it } from 'vitest';
import { fill, godWordText, contextFor, type FillContext } from '../../src/content/fill';
import { PRESETS, promptsFor, type Prompt } from '../../src/content/presets';
import { copy as resentments, RESENTMENT_PRAYER } from '../../src/content/resentments';
import { copy as fears, FEAR_PRAYER } from '../../src/content/fears';
import { copy as harms, SEX_PRAYER, SEX_MEDITATION, EARNEST_PRAYERS } from '../../src/content/harms';
import { FLAWS, FLAW_FOOTNOTES } from '../../src/content/checklist';
import { pledgeCopy } from '../../src/content/pledge';
import * as shared from '../../src/content/copy';
import { emptyDoc } from '../../src/core/doc';
import type { PresetId } from '../../src/core/doc';

const ctx: FillContext = { god: 'Higher Power', name: 'Sam', behavior: 'drinking', fellowship: 'AA' };
const ALL: PresetId[] = ['food', 'alcohol', 'narcotics', 'sexLove', 'general'];

describe('fill', () => {
  it('fill replaces tokens', () => {
    expect(fill('Infinite {god}', ctx)).toBe('Infinite Higher Power');
    expect(fill('{behavior} in {fellowship}', ctx)).toBe('drinking in AA');
  });

  it('fill never re-expands inserted values', () => {
    expect(fill('Hello {name}, {god}', { ...ctx, name: '{god}' })).toBe('Hello {god}, Higher Power');
    expect(fill('{name}', { ...ctx, name: '{name}' })).toBe('{name}');
    expect(fill('{name}', { ...ctx, name: '<img onerror=x>' })).toBe('<img onerror=x>');
    expect(fill('{name}', { ...ctx, name: "$& $1 $'" })).toBe("$& $1 $'");
  });

  it('custom god word is used', () => {
    expect(godWordText({ kind: 'god', custom: 'ignored' })).toBe('God');
    expect(godWordText({ kind: 'higherPower', custom: '' })).toBe('Higher Power');
    expect(godWordText({ kind: 'custom', custom: 'the Universe' })).toBe('the Universe');
    expect(godWordText({ kind: 'custom', custom: '' })).toBe('God');
    expect(godWordText({ kind: 'custom', custom: '   ' })).toBe('God');
  });

  it('contextFor reads the preset and God word from settings', () => {
    const doc = emptyDoc('food', { kind: 'higherPower', custom: '' });
    expect(contextFor(doc.settings, 'Sam')).toEqual({ god: 'Higher Power', name: 'Sam', behavior: 'compulsive eating', fellowship: 'OA' });
  });
});

describe('presets and prompts', () => {
  it('has the five presets with the agreed values', () => {
    expect(Object.keys(PRESETS).sort()).toEqual([...ALL].sort());
    expect(PRESETS.food).toMatchObject({ label: 'Food', draft: false, behavior: 'compulsive eating', fellowship: 'OA', pledgeListA: 'Binge foods', pledgeListB: 'Compulsive food behaviors' });
    expect(PRESETS.alcohol).toMatchObject({ draft: false, behavior: 'drinking', fellowship: 'AA' });
    expect(PRESETS.narcotics).toMatchObject({ draft: true, behavior: 'using', fellowship: 'NA' });
    expect(PRESETS.sexLove).toMatchObject({ label: 'Sex and love', draft: true, behavior: 'acting out', fellowship: 'my fellowship' });
    expect(PRESETS.general).toMatchObject({ label: 'Other / general', draft: false, behavior: 'my addiction', fellowship: 'my fellowship' });
    for (const id of ['alcohol', 'narcotics', 'sexLove', 'general'] as const) {
      expect(PRESETS[id]).toMatchObject({ pledgeListA: "What I'm abstaining from", pledgeListB: "Behaviors I'm abstaining from", pledgeText: 'I pledge to abstain absolutely from the above.' });
    }
    expect(PRESETS.food.pledgeText).toBe('I pledge to abstain absolutely from the above binge foods and compulsive food behaviors.');
  });

  const rendered = (list: Prompt[], preset: PresetId) =>
    promptsFor(list, preset).map((t) => fill(t, contextFor(emptyDoc(preset, { kind: 'god', custom: '' }).settings)));

  it('prompts adapt', () => {
    const food = rendered(fears.prompts, 'food');
    expect(food).toContain('Fear of compulsive eating');
    expect(food).not.toContain('Fear of drinking');
    expect(rendered(fears.prompts, 'alcohol')).toContain('Fear of drinking');
    expect(rendered(fears.prompts, 'narcotics')).toContain('Fear of using');
    expect(rendered(fears.prompts, 'food')).toContain('Fear of OA');
  });

  it('only-prompts appear only in the presets the data assigns', () => {
    for (const list of [resentments.prompts, fears.prompts, harms.prompts]) {
      for (const p of list) {
        for (const id of ALL) {
          expect(promptsFor([p], id).length).toBe(!p.only || p.only.includes(id) ? 1 : 0);
        }
      }
    }
    const bars = resentments.prompts.find((p) => p.text === 'People at bars')!;
    const casinos = resentments.prompts.find((p) => p.text === 'Casinos')!;
    expect(bars.only).toEqual(['alcohol', 'general']);
    expect(casinos.only).toEqual(['alcohol', 'narcotics', 'sexLove', 'general']);
    expect(promptsFor(resentments.prompts, 'food')).not.toContain('People at bars');
    expect(promptsFor(resentments.prompts, 'food')).not.toContain('Casinos');
    expect(promptsFor(resentments.prompts, 'alcohol')).toContain('People at bars');
    expect(promptsFor(resentments.prompts, 'alcohol')).toContain('Casinos');
  });
});

describe('prayers and verbatim passages', () => {
  const c = { ...ctx, god: 'Higher Power', name: 'Sam' };
  it('exact prayers', () => {
    expect(fill(RESENTMENT_PRAYER, c)).toBe('Higher Power, please help me show Sam the same tolerance, pity and patience I would cheerfully grant a sick friend');
    expect(fill(FEAR_PRAYER, c)).toBe('Higher Power, please remove my fear and direct my attention to what you would have me be');
    expect(fill(SEX_PRAYER, c)).toBe('Higher Power, please mold my ideals and help me to live up to them');
    expect(fill(SEX_MEDITATION, c)).toBe('Higher Power, please show me what to do about this [each] specific matter');
  });

  it('a name containing a token stays literal inside a prayer', () => {
    expect(fill(RESENTMENT_PRAYER, { ...c, name: '{god}' })).toContain('help me show {god} the same');
  });

  it('instructions and Big Book passages carry no tokens', () => {
    for (const cp of [resentments, fears, harms]) expect(cp.instructions).not.toMatch(/\{\w+\}/);
    expect(resentments.columns['4'].hint).not.toMatch(/\{\w+\}/);
    for (const line of [...EARNEST_PRAYERS.items, ...EARNEST_PRAYERS.closing, EARNEST_PRAYERS.intro]) expect(line).not.toMatch(/\{\w+\}/);
    expect(fears.instructions).toContain('we are now on a different basis; the basis of trusting and relying upon God. We trust infinite God rather than our finite selves. . . . Just to the extent that we do as we think He would have us, and humbly rely on Him, does He enable us to match calamity with serenity');
    expect(resentments.columns['4'].hint).toContain('We placed them before us in black and white. We admitted our wrongs honestly and were willing to set these matters straight.');
  });

  it('only known tokens are used anywhere', () => {
    const all = JSON.stringify([resentments, fears, harms, pledgeCopy, RESENTMENT_PRAYER, FEAR_PRAYER, SEX_PRAYER, SEX_MEDITATION, PRESETS]);
    for (const m of all.matchAll(/\{(\w*)\}/g)) expect(['god', 'name', 'behavior', 'fellowship']).toContain(m[1]);
  });

  it('earnest prayers match the handout', () => {
    expect(EARNEST_PRAYERS.intro).toBe('We earnestly pray for:');
    expect(EARNEST_PRAYERS.items).toEqual(['The right ideal', 'Guidance in each questionable situation', 'Sanity', 'The strength to do the right thing']);
    expect(EARNEST_PRAYERS.closing.join(' ')).toBe('If sex is troublesome, we throw ourselves the harder into helping others. We think of their needs and work for them. This takes us out of ourselves. It quiets the imperious urge, when to yield would mean heartache.');
  });
});

describe('handout definitions', () => {
  it('resentment affects definitions match p. 4', () => {
    const help = resentments.columns['3'].help!;
    const terms = help.map((h) => h.term);
    expect(terms).toEqual(['Self-Esteem', 'Security', 'Ambitions', 'Personal Relations', 'Sex Relations', 'Is any fear involved?']);
    const sec = help.find((h) => h.term === 'Security')!.meaning;
    for (const w of ['Financial', 'Personal', 'Emotional', 'Not feeling SAFE']) expect(sec).toContain(w);
  });

  it('column 4 help carries the p. 5 and p. 6 material', () => {
    const help = resentments.columns['4'].help!;
    const terms = help.map((h) => h.term);
    for (const t of ['Selfish', 'Dishonest', 'Self-Seeking', 'Frightened', 'Inconsiderate', 'Pride', 'Suspicion']) expect(terms).toContain(t);
    const text = JSON.stringify(help);
    for (const s of ['I am less than or better than', 'Gossip', 'Rejection', 'Being taken advantage of', 'I teach people how to treat me (by accepting unacceptable behavior)']) expect(text).toContain(s);
  });

  it('every inventory has the handout column count', () => {
    expect(Object.keys(resentments.columns)).toEqual(['1', '2', '3', '4']);
    expect(Object.keys(fears.columns)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(Object.keys(harms.columns)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });
});

describe('checklist', () => {
  // The p. 14 table has 41 + 41 + 39 rows in its three column groups.
  const P14_ROWS = 121;

  it('checklist is complete', () => {
    expect(FLAWS.length).toBe(P14_ROWS);
    const ids = FLAWS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FLAWS) {
      expect(f.defect.length).toBeGreaterThan(0);
      expect(f.opposite.length).toBeGreaterThan(0);
      for (const s of f.sources) expect(FLAW_FOOTNOTES[s]).toBeTruthy();
    }
    const has = (d: string, o: string) => FLAWS.some((f) => f.defect === d && f.opposite === o);
    expect(has('aggressive, belligerent', 'good-natured, gentle')).toBe(true);
    expect(has('wordy, verbose', 'frank, to the point, succinct')).toBe(true);
    expect(Object.keys(FLAW_FOOTNOTES).map(Number)).toEqual([1, 2, 3, 4]);
  });
});

describe('content hygiene', () => {
  it('no real-person examples', () => {
    const all = JSON.stringify([resentments, fears, harms, pledgeCopy, FLAWS, FLAW_FOOTNOTES, PRESETS, shared]);
    // Whole-word match: the p. 13 prompt "Ex-wives, ex-husbands, ex-partners" is real handout content, not an example.
    for (const bad of [/\bDave\b/, /\bex-husband\b/, /\bmy Dad\b/]) expect(all).not.toMatch(bad);
  });

  it('shared copy is verbatim', () => {
    expect(shared.DISCLAIMER).toBe('Not affiliated with Alcoholics Anonymous, Overeaters Anonymous, or any 12-step program.');
    expect(shared.PASSWORD_WARNING).toBe("If you forget it, your inventory can't be recovered. No one can reset it.");
    expect(shared.PLAIN_WARNING).toBe('Saved as readable text. Anyone using this device, or with the file, can read it.');
    expect(shared.PRIVACY_STATEMENT).toBe("Your inventory never leaves your browser. This site has no accounts, no analytics, and no database, and it never receives what you write. Like any website, it's delivered by a hosting provider (Cloudflare), which handles your IP address to deliver the page. We don't collect that information or use it. For the most privacy on a computer, you can download the offline version.");
  });

  it('never claims no IP logs', () => {
    const all = JSON.stringify(shared).toLowerCase();
    expect(all).not.toMatch(/no ip|ip logs|not log/);
  });
});
