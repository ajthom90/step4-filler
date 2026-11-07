# Step 4 Inventory Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a phone-first, browser-only static site that guides a person through a 12-step Step 4 inventory, saves only where they choose, and prints in the paper forms' layout.

**Architecture:** A static single-page Preact app. A framework-free `src/core` holds the document model, validation, encryption, saving, and the column-order engine, and is tested with Vitest. `src/content` holds all wording as data. `src/ui` renders it. Every Playwright test runs against the built site, served with the real `_headers` file, so the security policy is enforced during tests.

**Tech Stack:** TypeScript, Vite, Preact (the only runtime dependency), Vitest, Playwright, `@axe-core/playwright`, `pdfjs-dist` (dev only), Web Crypto, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-11-07-step4-inventory-design.md`. Read it before starting any task. Handout source: `reference/QuickStepsWeek1Handouts.pdf` (ignored by git).

## Global Constraints

- All inventory data stays in the browser. Nothing the site does may send it anywhere.
- No third-party assets, CDNs, Google Fonts, analytics, or service worker. System font stack only.
- No requests to another origin, ever, and no requests after load except the user-initiated offline file download.
- CSP, verbatim: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; manifest-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`. No inline scripts or style attributes in served HTML.
- Never render a stored or imported value as HTML. `dangerouslySetInnerHTML` and `innerHTML` are forbidden.
- Inventory fields: `spellcheck={false}`, `autocomplete="off"`. App root: `translate="no"`.
- AES-256-GCM, PBKDF2-SHA-256, 600,000 iterations minimum, Web Crypto only. New random salt per password, new random IV per save. Minimum password length 8, with no composition rules.
- Never claim "no IP logs" anywhere in site copy.
- Disclaimer, verbatim, on the first-visit screen, in the footer, and on every printed page: `Not affiliated with Alcoholics Anonymous, Overeaters Anonymous, or any 12-step program.`
- Password warning, verbatim: `If you forget it, your inventory can't be recovered. No one can reset it.`
- No-password warning, verbatim: `Saved as readable text. Anyone using this device, or with the file, can read it.`
- Column order is guided, never locked. Prayers never block the next column.
- The mockups' colors are placeholders. Visual design is left to the builder, in a calm, plain, non-clinical tone, with no streaks, badges, or celebratory effects.
- Inputs at 16px or larger. No horizontal scrolling down to 320px wide. WCAG 2.2 AA. Light and dark themes follow the system setting.
- Dependencies pinned exactly (`save-exact=true` in `.npmrc`), with `package-lock.json` committed.
- Site name, domain, feedback contact, and Big Book link live only in `site.config.ts`.
- Do not commit anything in `reference/` or `.superpowers/`. Do not deploy, create a Cloudflare project, or publish the repository without the owner asking.
- End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Storage full, blocked, or unavailable (private browsing, quota): the save must surface a visible failure, never show "saved," and keep the work in memory. Test in Task 4.
2. Two open tabs: a stale tab must not silently overwrite newer work. Test in Task 4.
3. A mobile browser discarding the page while a field has uncommitted typing: text is flushed on `pagehide` and `visibilitychange`, and a reopened page returns to the same step. Test in Task 8.
4. Deleting an entry after later columns were completed: its answers and visited markers go, the current step stays valid, and resume never lands on a deleted entry. Test in Task 5.
5. Hostile or awkward text (`<img onerror=...>`, 20,000 characters, emoji, right-to-left text, a name containing `{god}`): shown literally, never interpreted, and printed in full. Test in Tasks 6 and 12.

---

### Task 1: Project scaffold and test harness that enforces the security policy

**Files:**
- Create: `package.json`, `.npmrc`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `site.config.ts`, `index.html`, `src/main.tsx`, `public/_headers`, `public/icon.svg`, `scripts/serve-dist.mjs`
- Test: `tests/e2e/fixtures.ts`, `tests/e2e/security.spec.ts`

**Interfaces:**
- Produces:
  - `site.config.ts`: `export const site = { name: 'Step 4 Inventory', domain: '', feedbackUrl: '', bigBookUrl: 'https://www.aa.org/the-big-book' }`
  - `tests/e2e/fixtures.ts`: a Playwright `test` export, used by every later e2e test, which fails a test on any off-origin request, any post-load request other than the allow-list (`/manifest.webmanifest`, `/icon*`, the offline file), any CSP violation, or any `pageerror`. It ignores `blob:` and `data:` URLs, which never leave the device.
  - `scripts/serve-dist.mjs`: static server for `dist/` on port 4173 that applies the rules in `dist/_headers`, using only Node built-ins.
  - npm scripts: `build`, `test` (Vitest), `test:e2e` (build, then Playwright), `typecheck`.
  - Playwright projects: `chromium`, `firefox`, `webkit`, `pixel` (Pixel 7), `iphone` (iPhone 14).

- [ ] **Step 1: Write the failing tests**

`tests/e2e/security.spec.ts`, using the fixtures:
- `serves the exact security headers`: asserts the response's `content-security-policy` equals the Global Constraints string, `referrer-policy` is `no-referrer`, `x-content-type-options` is `nosniff`, `strict-transport-security` has `max-age=31536000`, and `permissions-policy` contains `camera=()`, `microphone=()`, and `geolocation=()`.
- `app renders with no violations`: loads `/`, and expects `#app` to be non-empty.
- `manifest allows adding to the home screen`: `/manifest.webmanifest` returns JSON with `display` equal to `standalone`, and the `name` from `site.config.ts`.
- `the harness catches a leak`: from the page, adds an `<img src="https://example.com/x.png">`, then asserts the fixture recorded that off-origin request. This proves the guard works. It's the one test that opts out of failing on it.
- `the harness catches a violation`: injects an inline script element and asserts the fixture recorded a CSP violation.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:e2e -- security.spec.ts --project=chromium`
Expected: FAIL because there is no build yet. (Install tooling first with `npm install`, and browsers with `npx playwright install`.)

- [ ] **Step 3: Build the scaffold**

Vite with the Preact JSX settings and one small plugin in `vite.config.ts` that emits `manifest.webmanifest` from `site.config.ts` (`display: standalone`, icon `icon.svg`). Set `build.modulePreload.polyfill` to `false`, which removes Vite's `fetch(` call from the bundle, and build a single JS chunk with no code splitting, which the offline file in Task 13 relies on. `index.html` has a neutral `<title>` from `site.name`, a root `<div id="app" translate="no">`, and no inline content. `public/_headers` holds the headers for `/*`. `src/main.tsx` renders a placeholder.

- [ ] **Step 4: Run to verify they pass**

Run: `npm run test:e2e -- security.spec.ts --project=chromium`
Expected: PASS

- [ ] **Step 5: Commit**

Commit all of the above with `chore: scaffold static site and security test harness`.

---

### Task 2: Document model and file validation

**Files:**
- Create: `src/core/doc.ts`, `src/core/validate.ts`
- Test: `tests/unit/validate.test.ts`

**Interfaces:**
- Produces, from `src/core/doc.ts`:

```ts
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
export function emptyDoc(preset: PresetId, godWord: GodWord): InventoryDoc;
export function newId(): string; // 128 random bits as hex, from crypto.getRandomValues
```

- From `src/core/validate.ts`: `export function validateDoc(value: unknown): InventoryDoc` (returns a freshly built object containing only known fields, and throws `FileError`), `export class FileError extends Error { code: 'too-large' | 'not-inventory' | 'newer-version' | 'corrupt' | 'wrong-password' }`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/validate.test.ts`:
- `accepts an empty doc and a fully populated doc unchanged` (deep equal).
- `drops unknown fields`, and `does not carry __proto__` from `JSON.parse('{"__proto__":{"x":1},...}')`: the result has no `x` on it or on `Object.prototype`.
- `rejects wrong types`: for `{name: 5}`, `{affects: {fear:'yes'}}`, `{trust:'maybe'}`, or `{preset:'cats'}`, throws `FileError` with code `corrupt`.
- `rejects non-inventory JSON` (`{}`, `[]`, `null`) with `not-inventory`.
- `rejects newer versions`: `version: 2` throws `newer-version`.
- `rejects duplicate ids`: two entries with the same `id` throw `corrupt`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/validate.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `doc.ts` and `validate.ts`**

Handwritten validators, with no schema library. Older versions go through a `migrate(value)` step, currently a pass-through for version 1, so that new versions can always read old files.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/unit/validate.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

`feat: add inventory document model and validation`

---

### Task 3: Encryption and file format

**Files:**
- Create: `src/core/crypto.ts`, `src/core/fileformat.ts`
- Test: `tests/unit/crypto.test.ts`, `tests/unit/fileformat.test.ts`

**Interfaces:**
- Consumes: `InventoryDoc`, `validateDoc`, `FileError` from Task 2.
- Produces:

```ts
// crypto.ts
export const KDF_ITERATIONS = 600_000;
export interface Envelope { format: 'step4-inventory-encrypted'; version: 1; kdf: 'PBKDF2-SHA-256'; iterations: number; salt: string; iv: string; ciphertext: string } // base64
export interface SessionKey { key: CryptoKey; salt: Uint8Array; iterations: number } // key is non-extractable
export function createKey(password: string): Promise<SessionKey>; // new random 16-byte salt
export function encrypt(doc: InventoryDoc, session: SessionKey): Promise<Envelope>; // new random 12-byte IV
export function decrypt(env: Envelope, password: string): Promise<{ doc: InventoryDoc; session: SessionKey }>;
// fileformat.ts
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export type Parsed = { kind: 'plain'; doc: InventoryDoc } | { kind: 'encrypted'; envelope: Envelope };
export function parseSaved(text: string): Parsed; // throws FileError
export function serialize(payload: InventoryDoc | Envelope): string;
export function backupFileName(date: Date): string; // `inventory-backup-YYYY-MM-DD.json`
```

- [ ] **Step 1: Write the failing tests**

`crypto.test.ts`:
- `round-trips a doc`.
- `wrong password throws FileError wrong-password`.
- `tampered ciphertext, IV, or salt throws`: flip one byte of each.
- `uses a new IV on every encrypt, and a new salt on every createKey`.
- `envelope reveals nothing`: `JSON.stringify(envelope)` contains no entry text and has exactly the keys in `Envelope`.
- `key cannot be exported`: `crypto.subtle.exportKey` rejects.
- `iterations` equals 600,000 on a new envelope; envelopes with `iterations` below 100,000 or above 10,000,000 throw `corrupt`, blocking both weakened files and a file built to hang the page.

`fileformat.test.ts`:
- `parses plain and encrypted saves`.
- `rejects oversize text` with `too-large`, before calling `JSON.parse`.
- `rejects invalid JSON` with `not-inventory`.
- `backupFileName` returns `inventory-backup-2026-11-07.json` for that date.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/crypto.test.ts tests/unit/fileformat.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement both modules**

Use `crypto.subtle` only. Bind `format` and `version` as AES-GCM additional data. The decrypted JSON still goes through `validateDoc`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/unit/crypto.test.ts tests/unit/fileformat.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

`feat: add password encryption and save file format`

---

### Task 4: Browser saving, autosave, and failure handling

**Files:**
- Create: `src/core/saver.ts`
- Test: `tests/unit/saver.test.ts`

**Interfaces:**
- Consumes: Task 3's `encrypt`, `decrypt`, `createKey`, `serialize`, `parseSaved`.
- Produces:

```ts
export type SaveMode = { kind: 'none' } | { kind: 'browser-plain' } | { kind: 'browser-encrypted'; session: SessionKey };
export type SaveStatus = 'unsaved' | 'saving' | 'saved' | 'failed' | 'stale';
export class Saver {
  constructor(storage: Storage | null, onStatus: (s: SaveStatus) => void, debounceMs?: number); // default 800
  readonly browserSaveAvailable: boolean;
  setMode(mode: SaveMode, doc: InventoryDoc): Promise<void>; // writes at once, replacing the old save only on success
  edited(doc: InventoryDoc): void;  // schedules an autosave; no-op write in mode 'none'
  flush(): Promise<void>;           // used on pagehide and before lock
  lock(): void;                     // cancels timers and clears the session from memory
  loadRaw(): string | null;
  eraseAll(): void;
  fileContents(doc: InventoryDoc, session?: SessionKey): Promise<string>;
  requestPersistence(): Promise<boolean>; // navigator.storage.persist where supported
}
export const STORAGE_KEY = 'step4-inventory';
```

- [ ] **Step 1: Write the failing tests**

`saver.test.ts`, using an in-memory `Storage` fake and fake timers:
- `writes nothing in mode none`: storage stays empty after `edited`.
- `plain mode autosaves after the debounce`, and status goes `saving` then `saved`.
- `encrypted mode never stores readable text`: an entry's text does not appear in storage, and a fresh decrypt returns it.
- `quota failure reports failed`: when `setItem` throws `QuotaExceededError`, status is `failed`, the previous stored value is intact, and the next edit retries. (Review Focus 1.)
- `null storage`: `browserSaveAvailable` is false, and `setMode` to a browser mode rejects. (Review Focus 1.)
- `storage from another tab marks stale`: after dispatching a `storage` event for `STORAGE_KEY` with a different value, status is `stale` and subsequent `edited` calls do not write until `setMode` is called again. (Review Focus 2.)
- `failed mode change keeps the old save`.
- `eraseAll removes the key and cancels pending writes`, and `lock clears the session and cancels timers`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/saver.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `Saver`**

`localStorage` is enough for a text inventory at this size. All storage access goes through try/catch because merely reading the property can throw.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/unit/saver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

`feat: add browser saving with autosave and failure handling`

---

### Task 5: Column-order engine

**Files:**
- Create: `src/core/flow.ts`, `src/core/edit.ts`
- Test: `tests/unit/flow.test.ts`, `tests/unit/edit.test.ts`

**Interfaces:**
- Consumes: Task 2's types.
- Produces:

```ts
// flow.ts
export type InventoryId = 'resentments' | 'fears' | 'harms';
export type StepKind = 'intro' | 'list' | 'causes' | 'text' | 'ticks' | 'choice' | 'prayer';
export interface Step { key: string; inventory: InventoryId; column: number; kind: StepKind; entryId?: string; causeId?: string; field?: string }
export function stepsFor(doc: InventoryDoc, inv: InventoryId): Step[];
export function nextStep(doc: InventoryDoc, inv: InventoryId): Step | null; // first unvisited
export function stepAfter(doc: InventoryDoc, inv: InventoryId, key: string): Step | null;
export function stepBefore(doc: InventoryDoc, inv: InventoryId, key: string): Step | null;
export function isBlank(doc: InventoryDoc, step: Step): boolean;
export function blanks(doc: InventoryDoc, inv: InventoryId): Step[]; // visited and blank
export function progress(doc: InventoryDoc, inv: InventoryId): { column: number; totalColumns: number; visited: number; total: number; status: 'not-started' | 'in-progress' | 'done' };
// edit.ts: pure, each returns a new doc
export function markVisited(doc: InventoryDoc, key: string): InventoryDoc;
export function addEntry(doc: InventoryDoc, inv: InventoryId, name: string): InventoryDoc;
export function removeEntry(doc: InventoryDoc, inv: InventoryId, entryId: string): InventoryDoc; // also prunes visited keys
export function addCause(doc: InventoryDoc, entryId: string, text: string): InventoryDoc;
export function removeCause(doc: InventoryDoc, entryId: string, causeId: string): InventoryDoc;
export function setField(doc: InventoryDoc, step: Step, value: string | boolean | YesNo): InventoryDoc;
```

- [ ] **Step 1: Write the failing tests**

`flow.test.ts`:
- `resentment order`: with person A (causes c1, c2) and person B (cause c3), keys are exactly:
  `res:intro`, `res:list`, `res:causes:A`, `res:causes:B`, `res:affects:A:c1`, `res:affects:A:c2`, `res:affects:B:c3`, `res:study`, `res:prayer:A`, `res:prayer:B`, `res:defect:A:selfish`, `res:defect:A:dishonest`, `res:defect:A:selfSeeking`, `res:defect:A:frightened`, followed by the same four for B.
- `fear order`: with fears F, G: `fear:intro`, `fear:list`, `fear:why:F`, `fear:why:G`, `fear:trust:F`, `fear:trust:G`, `fear:worked:F`, `fear:worked:G`, `fear:prayer:F`, `fear:prayer:G`, `fear:be:F`, `fear:be:G`.
- `harm order`: with H, J: `harm:intro`, `harm:list`, `harm:where:H:selfish`, `harm:where:H:dishonest`, `harm:where:H:inconsiderate`, the same three for J, `harm:arouse:H`, `harm:arouse:J`, `harm:fault:H`, `harm:fault:J`, `harm:relation:H`, `harm:relation:J`, `harm:sexPrayer:H`, `harm:sexPrayer:J`, `harm:meditation:H`, `harm:meditation:J`.
- `late entry is led through what it missed`: with every step visited up to column 4, after `addEntry`, `nextStep` is `res:causes:<new>`; after visiting it, `nextStep` continues with that entry's later columns.
- `can move past blanks`: `stepAfter` returns the next step regardless of blanks, and `blanks` lists the skipped text field.
- `an unticked ticks step is not blank once visited`; an unanswered `choice`, an empty `text`, and a `causes` step with no causes are blank.
- `a prayer not marked done never appears in blanks`.
- `progress` is `not-started`, then `in-progress`, then `done`, when all steps are visited, including with blanks.

`edit.test.ts`:
- `removing an entry prunes its visited keys, leaving other entries' keys`; `stepsFor` contains no reference to it, and `nextStep` still returns a valid step. Same for `removeCause`. (Review Focus 4.)
- `edits are pure`: the input doc is not mutated.
- `setField writes the right place` for one step of each kind.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/flow.test.ts tests/unit/edit.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement both modules**

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/unit/flow.test.ts tests/unit/edit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

`feat: add guided column-order engine`

---

### Task 6: Content from the handout, presets, and wording substitution

**Files:**
- Create: `src/content/resentments.ts`, `src/content/fears.ts`, `src/content/harms.ts`, `src/content/checklist.ts`, `src/content/pledge.ts`, `src/content/presets.ts`, `src/content/fill.ts`, `src/content/copy.ts`, `docs/content-review.md`
- Test: `tests/unit/content.test.ts`

**Interfaces:**
- Consumes: `PresetId`, `GodWord`, `InventoryId` from earlier tasks.
- Produces:

```ts
// fill.ts
export interface FillContext { god: string; name?: string; behavior: string; fellowship: string }
export function godWordText(w: GodWord): string;
export function fill(template: string, ctx: FillContext): string;
export function contextFor(settings: InventoryDoc['settings'], name?: string): FillContext;
// presets.ts
export interface Preset { id: PresetId; label: string; draft: boolean; behavior: string; fellowship: string; pledgeListA: string; pledgeListB: string; pledgeText: string }
export const PRESETS: Record<PresetId, Preset>;
export interface Prompt { text: string; only?: PresetId[] }
export function promptsFor(list: Prompt[], preset: PresetId): string[];
// each inventory file
export const copy: { title: string; instructions: string; pages: string; columns: Record<string, { heading: string; hint: string; help?: { term: string; meaning: string }[] }>; prompts: Prompt[] };
// checklist.ts
export interface FlawPair { id: string; defect: string; opposite: string; sources: number[] }
export const FLAWS: FlawPair[]; export const FLAW_FOOTNOTES: Record<number, string>;
// copy.ts: shared site copy
export const DISCLAIMER: string; export const PASSWORD_WARNING: string; export const PLAIN_WARNING: string; export const PRIVACY_STATEMENT: string;
```

Preset values:

| id | label | draft | behavior | fellowship |
| --- | --- | --- | --- | --- |
| `food` | Food | false | compulsive eating | OA |
| `alcohol` | Alcohol | false | drinking | AA |
| `narcotics` | Narcotics | true | using | NA |
| `sexLove` | Sex and love | true | acting out | my fellowship |
| `general` | Other / general | false | my addiction | my fellowship |

Food uses `Binge foods` and `Compulsive food behaviors`, with the p. 1 pledge wording. Other presets use `What I'm abstaining from` and `Behaviors I'm abstaining from`, with `I pledge to abstain absolutely from the above.`

- [ ] **Step 1: Write the failing tests**

`content.test.ts`:
- `fill replaces tokens`: `fill('Infinite {god}', ctx)` gives `Infinite Higher Power`.
- `fill never re-expands inserted values`: a name of `{god}` stays literally `{god}`, and `<img onerror=x>` passes through unchanged. (Review Focus 5.)
- `custom god word is used`; a blank custom word falls back to `God`.
- `prompts adapt`: for `food`, the fear prompts include `Fear of compulsive eating` and not `Fear of drinking`; for `alcohol`, `Fear of drinking`. `People at bars` and `Casinos` are only in the presets the data assigns.
- `exact prayers`, with a God word of Higher Power: `Higher Power, please help me show Sam the same tolerance, pity and patience I would cheerfully grant a sick friend`; `Higher Power, please remove my fear and direct my attention to what you would have me be`; `Higher Power, please mold my ideals and help me to live up to them`; `Higher Power, please show me what to do about this [each] specific matter`.
- `resentment affects definitions match p. 4`: the Security entry covers Financial, Personal, and Emotional.
- `checklist is complete`: ids are unique; every item has a defect; `FLAWS` includes aggressive, belligerent / good-natured, gentle and wordy, verbose / frank, to the point, succinct. Its length equals the number of rows you count on p. 14, written as a constant with a comment.
- `no real-person examples`: the serialized content contains none of `Dave`, `ex-husband`, or `my Dad`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/content.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Transcribe all content**

Read the handout pages with the Read tool's `pages` parameter: pp. 1-2, 4-8, 10-11, 13-14. Transcribe from the page images, not by guessing. Use `{god}`, `{name}`, `{behavior}`, and `{fellowship}` tokens in prompts, labels, and prayers. Keep passages shown as direct Big Book quotations verbatim, with no tokens. Write fresh examples only where needed.

Make the p. 6 lies/truth, self-seeking, and fear suggestions part of the column 4 help for resentments. Keep the earnest prayers from pp. 11-12 in `harms.ts`.

- [ ] **Step 4: Write `docs/content-review.md`**

List each change for the owner to check: every typo corrected (handout page, original, replacement), each piece of completed cut-off text from p. 6, and all drafted preset wording, including the prompts marked `only`. Include the privacy statement and the "Need support now?" wording.

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run tests/unit/content.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

`feat: add handout content, presets, and wording substitution`

---

### Task 7: App shell, first visit, home, and information pages

**Files:**
- Create: `src/ui/store.ts`, `src/ui/router.ts`, `src/ui/App.tsx`, `src/ui/Footer.tsx`, `src/ui/screens/Welcome.tsx`, `src/ui/screens/Home.tsx`, `src/ui/screens/Privacy.tsx`, `src/ui/screens/Support.tsx`, `src/ui/screens/Settings.tsx`, `src/ui/styles.css`
- Modify: `src/main.tsx`
- Test: `tests/e2e/shell.spec.ts`

**Interfaces:**
- Consumes: Task 5's `progress`, Task 6's `PRESETS`, `DISCLAIMER`, `PRIVACY_STATEMENT`, `site`.
- Produces:

```ts
// store.ts
export interface AppState { doc: InventoryDoc | null; route: Route; saveStatus: SaveStatus; mode: SaveMode; editsSincePrompt: number; locked: boolean }
export function useApp(): { state: AppState; update(fn: (d: InventoryDoc) => InventoryDoc): void; go(route: Route): void; saver: Saver; lock(): void };
// router.ts: hash routes only
export type Route = { name: 'welcome' | 'home' | 'privacy' | 'support' | 'settings' | 'checklist' | 'pledge' | 'print' | 'save' | 'unlock' } | { name: 'step'; inventory: InventoryId; key?: string };
export function parseRoute(hash: string): Route; export function routeHash(r: Route): string;
```

- [ ] **Step 1: Write the failing tests**

`shell.spec.ts`, using the Task 1 fixtures:
- `first visit shows the disclaimer and creates nothing in storage`: after choosing Food and Higher Power, `localStorage` has zero keys.
- `all five presets are offered`, and narcotics and sex-and-love show a draft label with a feedback link when `site.feedbackUrl` is set (no link if empty).
- `home lists every section with progress`: Resentments, Fears, Sex conduct and harms, Flaws and assets checklist, Abstinence pledge (labeled optional).
- `footer disclaimer appears on every screen`.
- `privacy page says the required things`: contains the `PRIVACY_STATEMENT` and mentions extensions and backups. Across all screens, the text does not contain `no IP`.
- `settings change preset and word without losing entries`.
- `support page offers a sponsor or trusted person, 988, and local services`, as plain links, and says the site does not replace a sponsor or professional help.
- `first-visit choices are not saved`: a reload before any save method is chosen returns to the first-visit screen. This is expected, because nothing is written until the person chooses, so don't write early to avoid it.
- `theme follows the system`: with `colorScheme: 'dark'`, the body background differs from light.
- `no horizontal scroll at 320px` on each screen.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:e2e -- shell.spec.ts --project=chromium`
Expected: FAIL

- [ ] **Step 3: Implement the shell and screens**

Hash routing, no data in URLs. On startup, the store reads `saver.loadRaw()`: a plain save loads directly in `browser-plain` mode, and an encrypted one goes to the `unlock` route, whose screen Task 11 builds. `update` calls `saver.edited`, and the store calls `saver.flush` on `pagehide` and on `visibilitychange` to hidden. On a route change, move focus to the screen's `h1`. Show `site.name` in one place only. All styles go in `styles.css`, with light and dark tokens; no style attributes in HTML, and no CSS framework.

- [ ] **Step 4: Run to verify they pass**

Run: `npm run test:e2e -- shell.spec.ts --project=chromium`
Expected: PASS

- [ ] **Step 5: Commit**

`feat: add app shell, first visit, home, and information pages`

---

### Task 8: Guided step runner with the resentment inventory

**Files:**
- Create: `src/ui/screens/StepRunner.tsx`, `src/ui/steps/IntroStep.tsx`, `src/ui/steps/ListStep.tsx`, `src/ui/steps/CausesStep.tsx`, `src/ui/steps/TextStep.tsx`, `src/ui/steps/TicksStep.tsx`, `src/ui/steps/ChoiceStep.tsx`, `src/ui/steps/PrayerStep.tsx`, `src/ui/HelpSheet.tsx`, `src/ui/stepCopy.ts`
- Modify: `src/ui/App.tsx`, `src/ui/styles.css`
- Test: `tests/e2e/resentments.spec.ts`

**Interfaces:**
- Consumes: Tasks 5, 6, and 7.
- Produces:
  - `export function stepCopy(doc: InventoryDoc, step: Step): { eyebrow: string; question: string; hint: string; help?: { term: string; meaning: string }[]; prompts?: string[]; options?: { value: string; label: string }[] }` in `src/ui/stepCopy.ts`. This is the single place mapping a step to its wording. Task 9 extends it.
  - `export async function startWithBrowserSave(page: Page, doc?: Partial<InventoryDoc>): Promise<void>` in `tests/e2e/fixtures.ts`, which seeds a plain save in `localStorage` and opens home. Every flow test in Tasks 8, 9, and 10 uses it, so that the save prompt from Task 11 doesn't interrupt them. Only Task 11's tests exercise the prompt.

- [ ] **Step 1: Write the failing tests**

`resentments.spec.ts`, on the `pixel` and `iphone` projects:
- `complete flow in column order`: enter two people, finish the list with `That's everyone for now`, and pass through each cause, affects, study, prayer, and defect screen, asserting each screen's heading in the exact order from Task 5.
- `prayer includes the person's name and the chosen word`, and moving on without marking it done is allowed.
- `move past a blank`: skipping a text screen is allowed, home then shows what is still blank, and following that link opens the blank step.
- `add a name during column 3`: the flow leads through the new name's causes, then returns to the unfinished work.
- `study instruction screen shows the page range` and a labeled link to `site.bigBookUrl` that opens only on click.
- `help sheet opens and closes without losing typed text`, and the Selfish help includes the p. 5 definition.
- `typing is flushed when the page is hidden`: with browser saving on, type without pressing Next, dispatch `visibilitychange` and `pagehide`, reload, and the text and step are restored. (Review Focus 3.)
- `reload resumes at the same step` with browser saving on. (Review Focus 3.)
- `hostile text shows literally`: a name of `<img src=x onerror=alert(1)>` displays as that text, and no `img` element is created. (Review Focus 5.)
- `spellcheck is off`: every `textarea` and text `input` has `spellcheck="false"` and `autocomplete="off"`.

All of these tests begin with `startWithBrowserSave`, except where a test needs a specific setup of its own.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:e2e -- resentments.spec.ts --project=pixel`
Expected: FAIL

- [ ] **Step 3: Implement the runner and step components**

One question per screen; a progress bar from `progress`; Back and Next at the bottom. Text fields commit as typed to the store, which handles the flush. `Next` calls `markVisited` and goes to `stepAfter`. Opening an inventory from home goes to `nextStep`, or to a finished view listing entries with blanks and an edit link when everything is visited. Every list step offers its prompts in a help sheet, with `Add` buttons. Screen readers hear the step change through focus on the `h1`.

- [ ] **Step 4: Run to verify they pass**

Run: `npm run test:e2e -- resentments.spec.ts --project=pixel && npm run test:e2e -- resentments.spec.ts --project=iphone`
Expected: PASS

- [ ] **Step 5: Commit**

`feat: add guided step runner and resentment inventory`

---

### Task 9: Fear and harms inventories

**Files:**
- Modify: `src/ui/stepCopy.ts`
- Test: `tests/e2e/fears-harms.spec.ts`

**Interfaces:**
- Consumes: `stepCopy`, `StepRunner`, and step components from Task 8.

- [ ] **Step 1: Write the failing tests**

`fears-harms.spec.ts`, on `pixel`:
- `fear flow follows column order` from Task 5, and the trust choice reads `Infinite Higher Power` and `My Finite Self` when that word is chosen.
- `fear prayer text matches`, and marking is optional.
- `the fear prompts come from p. 10, adapted to the preset`.
- `harms flow follows column order`, including Selfish, Dishonest, and Inconsiderate; Jealousy, Suspicion, and Bitterness ticks; `Was each relation selfish?` Yes/No; and both prayers.
- `earnest prayers stay available` from the help sheet on every harms step.
- `the harms prompts come from p. 13`.
- `each inventory intro names its pages`: `63` to `67`, `67` and `68`, and `68` to `70`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:e2e -- fears-harms.spec.ts --project=pixel`
Expected: FAIL

- [ ] **Step 3: Extend `stepCopy` for both inventories**

Should need little or no new UI beyond the wording. If a screen needs a new component, justify it against the Task 8 step kinds.

- [ ] **Step 4: Run to verify they pass**

Run: `npm run test:e2e -- fears-harms.spec.ts --project=pixel`
Expected: PASS

- [ ] **Step 5: Commit**

`feat: add fear and harms inventories`

---

### Task 10: Flaws checklist and optional pledge

**Files:**
- Create: `src/ui/screens/Checklist.tsx`, `src/ui/screens/Pledge.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/screens/Home.tsx`
- Test: `tests/e2e/checklist-pledge.spec.ts`

**Interfaces:**
- Consumes: `FLAWS`, `FLAW_FOOTNOTES`, `PRESETS`, `update` from earlier tasks.

- [ ] **Step 1: Write the failing tests**

`checklist-pledge.spec.ts`:
- `each flaw shows its opposite aspect, and tapping selects it`, with `aria-pressed` or a checkbox reflecting the state.
- `selections and the other field persist across reload` with browser saving on, and the footnote sources are readable.
- `checklist has no horizontal scroll at 320px` and is searchable by typing a word (`jealous`).
- `food pledge uses Binge foods and Compulsive food behaviors`; narcotics uses `What I'm abstaining from`.
- `pledge can be skipped`: home does not count it toward any required progress.
- `typed name and date are kept`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:e2e -- checklist-pledge.spec.ts --project=pixel`
Expected: FAIL

- [ ] **Step 3: Implement both screens**

- [ ] **Step 4: Run to verify they pass**

Run: `npm run test:e2e -- checklist-pledge.spec.ts --project=pixel`
Expected: PASS

- [ ] **Step 5: Commit**

`feat: add flaws checklist and optional pledge`

---

### Task 11: Save, open, lock, and erase screens

**Files:**
- Create: `src/ui/screens/Save.tsx`, `src/ui/screens/Unlock.tsx`, `src/ui/SavePrompt.tsx`, `src/ui/SaveStatus.tsx`, `src/ui/download.ts`
- Modify: `src/ui/store.ts`, `src/ui/App.tsx`, `src/ui/screens/Home.tsx`, `src/ui/screens/Settings.tsx`
- Test: `tests/e2e/saving.spec.ts`

**Interfaces:**
- Consumes: `Saver`, `createKey`, `decrypt`, `parseSaved`, `serialize`, `backupFileName`, warnings from `copy.ts`.
- Produces: `export const SAVE_PROMPT_AFTER = 3; export const SAVE_REPROMPT_EVERY = 10;` in `src/ui/SavePrompt.tsx`, counted in committed edits; `export function downloadText(name: string, text: string): void` in `download.ts`, using a blob URL.

- [ ] **Step 1: Write the failing tests**

`saving.spec.ts`, with a fixed sentinel string in entries:
- `prompts after the third edit, and storage is empty until a choice is made`; `Not now` hides it until 10 more edits.
- `both warnings show the exact wording`.
- `browser save without password`: the sentinel is readable in `localStorage`, and it autosaves subsequent edits.
- `browser save with password`: the sentinel is not in `localStorage`; reload asks for the password; the right one restores it; the wrong one shows an error and leaves the save intact.
- `password under 8 characters is refused`.
- `download then open round-trips`, for plain and password files: the file name matches `inventory-backup-YYYY-MM-DD.json`, contains no entry text in the name, and the encrypted file does not contain the sentinel.
- `opening over existing data asks first`; cancel leaves data unchanged.
- `bad files are rejected with a clear message and data unchanged`: not JSON, a wrong-format JSON, a newer version, a tampered encrypted file, a file over 5 MB.
- `file-only use warns before leaving` when there are unsaved changes (`beforeunload` is registered), and shows the unsaved indicator.
- `Lock clears the screen and requires the password again`.
- `change password` works and the old password no longer opens the save; `remove password` shows the plain warning first.
- `Erase everything needs confirmation, clears localStorage, and says it can't delete downloaded or printed copies`.
- `save failure is visible`: with `setItem` stubbed to throw, the status shows failure and never `Saved`.
- `second tab sees the stale warning`, using two pages in one context, and can't silently overwrite.
- `save screen recommends a backup file` and explains that browser data can be cleared.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:e2e -- saving.spec.ts --project=chromium`
Expected: FAIL

- [ ] **Step 3: Implement the screens and store wiring**

Call `requestPersistence` on the first browser save. Revoke blob URLs after download. Use a password field with `autocomplete="new-password"` so password managers can help. Don't use `autocomplete="off"` here, because the Global Constraint applies to inventory fields.

- [ ] **Step 4: Run to verify they pass**

Run: `npm run test:e2e -- saving.spec.ts --project=chromium && npm run test:e2e -- saving.spec.ts --project=webkit`
Expected: PASS

- [ ] **Step 5: Commit**

`feat: add save, open, lock, and erase screens`

---

### Task 12: Printable forms

**Files:**
- Create: `src/ui/screens/Print.tsx`, `src/ui/print/ResentmentForm.tsx`, `src/ui/print/FearForm.tsx`, `src/ui/print/HarmForm.tsx`, `src/ui/print/ChecklistForm.tsx`, `src/ui/print/PledgeForm.tsx`, `src/ui/print.css`
- Modify: `src/ui/App.tsx`, `src/ui/screens/Home.tsx`
- Test: `tests/e2e/print.spec.ts`

**Interfaces:**
- Consumes: the doc, Task 6's content, `DISCLAIMER`.

- [ ] **Step 1: Write the failing tests**

`print.spec.ts`, Chromium only, using `page.pdf()` and `pdfjs-dist` to read each page's text:
- `disclaimer appears on every page` of a multi-page print.
- `resentment form matches the paper layout`: table columns in order, `I'm resentful at`, `The causes`, the six affects headings, and `Core Character Defects`; ticks appear in the right rows. Same check for the fear and harms forms' columns.
- `a 20,000-character entry prints in full`: its last word appears in the PDF. (Review Focus 5.)
- `hostile text prints literally`. (Review Focus 5.)
- `landscape pages for landscape forms`: page width exceeds height for resentments, fears, and harms; the pledge is portrait.
- `can print one section or all of them`.
- `warns before printing`: a dialog says a saved PDF is readable by anyone who has it, and appears before `window.print`.
- `chosen word appears` in the forms' headings and prayers.
- `screen controls don't print`: no footer duplicates, nav, or buttons in the PDF text.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:e2e -- print.spec.ts --project=chromium`
Expected: FAIL

- [ ] **Step 3: Implement forms and print CSS**

Real HTML tables with repeating `thead`, and a fixed print footer for the disclaimer. Use named `@page` rules for landscape; browsers that ignore them still print legibly. Let rows break across pages for long entries. Include a screen preview so a phone can check before printing.

- [ ] **Step 4: Run to verify they pass**

Run: `npm run test:e2e -- print.spec.ts --project=chromium`
Expected: PASS

- [ ] **Step 5: Commit**

`feat: add printable forms in the paper layout`

---

### Task 13: Offline single-file version

**Files:**
- Create: `scripts/build-offline.mjs`
- Modify: `package.json`, `src/ui/screens/Privacy.tsx`, `src/ui/screens/Home.tsx`, `src/ui/screens/Save.tsx`
- Test: `tests/e2e/offline.spec.ts`

**Interfaces:**
- Consumes: `dist/` output.
- Produces: `dist/step4-inventory-offline.html`. It's linked from the privacy page as a computer option, with a file name free of any entry data. The Task 1 fixture's allow-list already covers this path.

- [ ] **Step 1: Write the failing tests**

`offline.spec.ts`, opening the file with `file://`:
- `has its own policy`: a meta CSP with `default-src 'none'`, `connect-src 'none'`, `form-action 'none'`, `base-uri 'none'`, and hashes for its inline script and style (no `unsafe-inline`).
- `makes zero network requests` through a full resentment entry and download.
- `download then reopen restores progress`, with and without a password.
- `when local storage isn't available, it says so and uses files`: with storage stubbed unavailable, the browser option is hidden, with an explanation.
- `no reference to an external asset` in the file: the only `http` strings are in user-clicked link URLs.
- `hosted privacy page links to it, described as a computer option`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:e2e -- offline.spec.ts --project=chromium`
Expected: FAIL

- [ ] **Step 3: Implement `build-offline.mjs`**

Runs after `vite build`. Inlines the JS and CSS from `dist/` into one HTML file and computes SHA-256 hashes for the meta CSP. Escape `</script>` in the inlined bundle. Use `site.config.ts` values already in the bundle.

- [ ] **Step 4: Run to verify they pass**

Run: `npm run test:e2e -- offline.spec.ts --project=chromium && npm run test:e2e -- offline.spec.ts --project=firefox`
Expected: PASS

- [ ] **Step 5: Commit**

`feat: add offline single-file version`

---

### Task 14: Full verification and launch documents

**Files:**
- Create: `tests/e2e/accessibility.spec.ts`, `tests/e2e/privacy-sweep.spec.ts`, `docs/launch-checklist.md`, `docs/deploy.md`, `README.md`
- Modify: any file with a defect these tests reveal

**Interfaces:**
- Consumes: the whole app.

- [ ] **Step 1: Write the tests**

`accessibility.spec.ts`: Axe (WCAG 2.2 A and AA tags) reports zero violations on every screen, in both light and dark, on each step kind, the save screen, and the print preview. `can complete a whole resentment entry using only the keyboard`. `input font size is at least 16px` on every field. `tap targets are at least 44px` on the bottom buttons.

`privacy-sweep.spec.ts`: a run through every section, saving, and opening a file, with a sentinel string:
- The sentinel never appears in any request URL, header, or body.
- `dist/` contains no off-origin script, style, or font reference (a scan of the build output); only the configured plain links (`bigBookUrl`, 988 information, `feedbackUrl`) may appear.
- `package.json` has `preact` as its only runtime dependency.
- The bundle contains no `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, or `EventSource` usage from app code. If a match comes from the Preact or Vite runtime, verify and allow-list that exact line.

- [ ] **Step 2: Run everything across all browsers**

Run: `npm run typecheck && npm test && npm run test:e2e`
Expected: all PASS on `chromium`, `firefox`, `webkit`, `pixel`, and `iphone`. Fix any failures through their owning code rather than weakening the test.

- [ ] **Step 3: Write `docs/deploy.md`**

Steps to create the Cloudflare Pages project (build command `npm run build`, output `dist`), confirm in the live response that the CSP and other headers match, and keep Web Analytics, Zaraz, Rocket Loader, and email obfuscation off. Note that deployment is the owner's action.

- [ ] **Step 4: Write `docs/launch-checklist.md`**

Owner items, unchecked:
- Choose a site name, domain, and feedback contact, then set them in `site.config.ts`.
- Confirm that `bigBookUrl` is the right link and works.
- Review `docs/content-review.md`.
- Review the privacy statement against what the Cloudflare account actually exposes.
- On a real iPhone and Android phone: run an inventory, save, reopen, download, reopen a file, and print. Add to the home screen and check that data is still there. Try the offline file, and update the site's wording to what actually happens.
- Line up reviewers for the narcotics and sex-and-love presets.
- Decide when to make the repository public.

- [ ] **Step 5: Write `README.md`**

What it is, the privacy model and its limits, the disclaimer, how to run and test it, and a warning not to commit `reference/`.

- [ ] **Step 6: Run everything again and commit**

Run: `npm run typecheck && npm test && npm run test:e2e`
Expected: all PASS.

Commit: `test: add accessibility and privacy sweeps, and launch documents`
