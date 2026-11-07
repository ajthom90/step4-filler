# Step 4 Inventory Website: Design

Date: 2026-11-07
Status: approved by owner 2026-11-07

In this document, **Owner** marks a decision the site's owner made. **Builder's call** marks a choice made while writing the design, which the owner can overrule. Anything else unmarked follows from those.

## Why this exists

People working a 12-step program complete a Step 4 personal inventory. The owner's group uses a fillable PDF handout, which works, but is hard to use on a phone. Many millennial and Gen Z members do everything on their phones and will not print a PDF and write by hand. The site's purpose is to make Step 4 more accessible to them without changing the method.

An inventory holds some of the most sensitive things a person will ever write: names of real people, sexual history, and harm done. Privacy is therefore a core requirement, not a feature.

## Goals

- A person can complete all of Step 4 comfortably on a phone, and also on a tablet or computer.
- The guided flow preserves the handout's method, especially its repeated instruction to work **column by column, top to bottom**.
- All data stays in the browser. No inventory data, and no site-collected data of any kind, ever reaches a server.
- A person can stop and pick up later, using browser storage or a downloaded file.
- A person can print the result, laid out like the paper forms, to share with a sponsor.
- Any 12-step fellowship can use it.

## Non-goals

- Accounts, sync between devices, or any backend.
- Sharing features. People share by printing or sending their own file.
- AI assistance or feedback on what someone writes.
- Analytics, including privacy-friendly analytics. **Owner** ruled out collecting any data; this also means no usage numbers.
- Steps other than Step 4.
- More than one inventory per browser. Someone can keep others as downloaded files.

## Failure conditions

The project has failed, even if everything works, if any of these is true:

- Inventory text can leave the device through anything the site does.
- The site makes a privacy claim that its hosting cannot honor.
- Someone loses written work without having been warned that it could happen.
- The method has been simplified into something a sponsor would not recognize.
- It suggests an affiliation with AA, OA, or any other program.

## Hosting and the privacy claim

**Owner:** Cloudflare Pages, static files only.

Cloudflare handles visitor IP addresses when it serves the site, under its own policies, so the site **must not** claim that no IP addresses are logged. **Builder's call:** proposed wording, near the top of the privacy page, for the owner's review:

> Your inventory never leaves your browser. This site has no accounts, no analytics, and no database, and it never receives what you write. Like any website, it's delivered by a hosting provider (Cloudflare), which handles your IP address to deliver the page. We don't collect that information or use it. For the most privacy on a computer, you can download the offline version.

Before launch, confirm what the Cloudflare account actually exposes to the owner and adjust this wording to match, so it stays accurate.

The privacy page must also state what the site cannot protect against: browser extensions that can read pages, a device someone else can open, and downloaded or printed copies that end up in cloud backups or the Downloads folder.

**Cloudflare configuration:** keep Web Analytics, Zaraz, Rocket Loader, and email obfuscation off. Pages deploys must not inject anything into the page, and the security policy below would block it if they tried.

## Privacy and security requirements

### Network

Security headers, set through the Pages `_headers` file:

- `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; manifest-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`
- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` with a long max-age
- `Permissions-Policy` denying camera, microphone, geolocation, and similar features

Everything else required by this section:

- All assets are served from the site's own origin: no CDNs, Google Fonts, or third-party scripts.
- The page makes no network requests after it loads. Links to outside sites are ordinary user-clicked links.
- Automated tests fail the build if any request is made to another origin or any request is made after load.

### Handling what people type

- Treat all stored and imported values as text. Never render them as HTML.
- Disable `spellcheck` on inventory fields, because some browsers' enhanced spellcheck sends typed text to a server. **Builder's call.**
- Set `autocomplete="off"` and mark the app `translate="no"`, so browser features are less likely to store or send entries. **Builder's call.**

### Saving

Each person chooses, and sees the relevant warning:

| Save type | Required warning (**Owner**) |
| --- | --- |
| With a password | If you forget it, your inventory can't be recovered. No one can reset it. |
| Without a password | Saved as readable text. Anyone using this device, or with the file, can read it. |

Saving works in two places, in either mode:

- **Browser:** saved on this device, in this browser.
- **File:** a downloaded file. Opening it on the site later restores progress, on any device.

Behavior:

- **Builder's call:** the site prompts for a save method after the first few entries, because mobile browsers discard background tabs and could otherwise lose work. Nothing is written to storage until the person has chosen.
- **Builder's call:** once someone has chosen browser saving, the site autosaves there, using the same mode. Files can't autosave, so anyone using only files sees an "unsaved changes" indicator and a warning when leaving the page.
- A person can change between modes and can change their password.
- A password-protected browser save asks for the password when the site opens. A **Lock** action clears the data and key from memory immediately.
- **Erase everything** deletes all browser-stored data after a confirmation, and says plainly that it cannot delete files already downloaded or printed.
- Opening a file when browser data exists asks whether to replace it. Nothing is overwritten silently.
- Safari can delete site data after about a week without a visit, and other browsers can clear it under storage pressure. The site requests persistent storage where supported, and the save screen recommends downloading a backup file.
- Downloaded file names contain only a neutral name and date, never entry content.

### Encryption

- Use only the browser's built-in Web Crypto: AES-256-GCM, with a key derived through PBKDF2-SHA-256 at 600,000 or more iterations. Do not write custom cryptography.
- Use a new random salt per password and a new random IV for every save.
- Encrypted saves expose only the format name, version, key-derivation settings, salt, IV, and ciphertext, including no entry counts or progress.
- Passwords are never stored. Minimum 8 characters; encourage a longer passphrase, but don't impose composition rules.

### Opening files

- Treat every opened file as untrusted. Enforce a size limit, validate against the schema, and reject unknown or malformed data with a clear message that leaves current data untouched.
- Files carry a format version. Newer versions of the site must keep reading older files.

### Offline version

Provide a single self-contained HTML file to download from the site, which works without a connection and contains its own restrictive policy in a meta tag. Saving and opening files must work there. Browser saving may be unavailable or unreliable from a local file; if so, the offline version says so and relies on downloaded files.

**Builder's call:** the offline file is presented as a computer option, because phones may not run a downloaded HTML file properly. Test this on iOS and Android and describe the actual result on the site.

**Builder's call:** include a web app manifest so people can add the site to their home screen, which may also give saved data better protection from Safari's deletion. Do not add a service worker: it would add code to trust, and the site doesn't need to load without a connection beyond the offline file. Test and describe the real home screen behavior on the save screen, without promising protection that testing doesn't confirm.

### Open source

**Builder's call, recommended to the owner:** the source is published so that people can check these claims. The owner decides when the repository goes public. The handout PDF stays out of the repository (`reference/` is ignored by git) because its filled-in examples may describe real people.

## Disclaimers

**Owner:** the site states it is not affiliated with Alcoholics Anonymous, Overeaters Anonymous, or any 12-step program. Show this on the first-visit screen, in the site footer, and on every printout.

**Builder's call:** the site also says that it does not replace a sponsor or professional help, and offers a small "Need support now?" section suggesting a sponsor or trusted person and a crisis line such as 988 in the US, with a note to use local services elsewhere. This content is emotionally heavy, so it should remain easy to find but never interrupt the flow.

## Experience

Mobile first, one question per screen. Mockups from the design conversation are in `.superpowers/brainstorm/30627-1794072754/content/` (`overall-flow.html`), with the chosen resentment flow in `resentment-flow.html` at `.superpowers/brainstorm/30326-1794072712/content/` (option A). They show layout and flow; colors and wording are placeholders.

### First visit

The person chooses a program preset and the word they use for God, and sees the disclaimer and a short privacy statement. Both choices can be changed later.

### Presets

**Owner:** presets for food, alcohol, narcotics, and sex and love, plus "Other / general."

**Builder's call:** presets change only the program-specific wording. The inventories, columns, and order are the same for everyone.

- Prompt wording that mentions the substance, such as "Fear of drinking" becoming "Fear of using."
- Prompts added or removed where they only fit one program, such as "People at bars" or "Casinos."
- Pledge wording: food uses "binge foods and compulsive food behaviors," and others use their equivalent or "what I'm abstaining from." The pledge is optional for every preset.

The handout covers only food and alcohol directly, so the builder drafts the wording for the other presets. **Owner:** launch does not wait for review. The narcotics and sex-and-love presets are marked as draft and open to feedback, and the owner finds fellowship reviewers afterward. Because the site has no backend, feedback goes through a contact method the owner provides; that link is a plain user-clicked link.

### Word for God

Offer God, Higher Power, or a custom word. Substitute it in the site's prompts, labels, and prayers (for example, "Infinite Higher Power"). **Builder's call:** passages presented as direct Big Book quotations stay verbatim.

### Home

Shows each section with its progress, the save status, and links to print, help and word lists, and Erase everything. Sections can be done in any order.

### Guided inventories

Every inventory follows the same rule: **finish each column for all entries before starting the next column.** People can go back and edit anything, add an entry at any time, and stop at any point and return to the same place.

**Owner:** the order is guided, not locked:

- The flow always leads through the columns in order and shows what is still blank.
- A person can knowingly move past a blank and return to it later. The site never traps them on an entry.
- The person decides when an open-ended list, such as column 1, is complete.
- An entry added later is led through each column it missed.
- Prayers are offered and can be marked done, but never block the next column.
- A tick-box column with nothing ticked counts as answered once the person moves past it.

Each screen offers the relevant reference material one tap away, without leaving the flow. Each inventory opens with its instructions and the Big Book page numbers to study first, because the handout makes that study a prerequisite.

**Owner:** the site gives page numbers and a clearly labeled, user-clicked link to an online copy of the book. It does not reproduce any of the book beyond what the handout already includes. The link must not imply affiliation, and clicking it is the one point where the person leaves the site.

**Resentments** (handout pp. 2-7)

1. **I'm resentful at:** list all people, institutions, and principles, using the prompts on p. 7.
2. **The causes:** for each entry in turn, list every cause.
3. **Affects my:** for each cause in turn, select any of Self-Esteem, Security (Pocketbooks), Ambitions, Personal Relations, Sex Relations, and "Is any fear involved?" Definitions from p. 4.
4. **Before column 4:** show the instruction to study from the bottom of p. 65 to the end of the third paragraph on p. 67, and the Resentment Prayer. For each person, offer the prayer with their name filled in (“God, please help me show [name] the same tolerance, pity and patience I would cheerfully grant a sick friend”), with a way to mark it done.
5. **Core character defects:** for each person in turn, write Selfish, Dishonest, Self-Seeking, and Frightened. Definitions from p. 5, and the lies/truth, self-seeking, and fear lists from p. 6 as optional suggestions.

**Fears** (handout pp. 8-10)

1. **I'm fearful of:** list all fears, with the p. 10 list as prompts.
2. **Why do I have the fear?**
3. **Where was my trust and reliance?** Infinite God or My Finite Self.
4. **Did self-reliance work?** Yes or No.
5. **Fear Prayer:** “God, please remove my fear and direct my attention to what you would have me be,” marked complete for each fear.
6. **What would God have you be?** A written answer for each fear.

**Sex conduct and harms** (handout pp. 11-13)

1. **Whom did I hurt?** List everyone, using the p. 13 prompts.
2. **Where was I:** Selfish, Dishonest, and Inconsiderate, written for each entry.
3. **Did I arouse:** Jealousy, Suspicion, or Bitterness, selected for each entry.
4. **Where was I at fault, and what should I have done instead?**
5. **Was each relation selfish?** Yes or No.
6. **Sex Prayer:** “God, please mold my ideals and help me to live up to them,” marked complete.
7. **Sex Meditation:** “God, please show me what to do about this [each] specific matter,” marked complete.

The Earnest Prayers text from p. 70 of the Big Book (handout pp. 11-12, right column) stays available as reference throughout this inventory.

**Flaws and assets checklist** (handout p. 14)

Tap any character defect that applies, each shown with its opposite aspect, plus a free-text "other" entry for other ways of acting, feeling, or thinking that cause pain. The checklist's footnoted sources are shown as reference.

**Pledge** (handout p. 1, optional)

Two lists, such as binge foods and compulsive food behaviors on the food preset, followed by the pledge, a typed name, and a date. **Builder's call:** the typed name is treated as a signature only in the printed copy.

### Printing

Print or save as PDF from any section or for all sections:

- Lays out each inventory like its paper form, in landscape where the form is landscape, so it's familiar to sponsors.
- Rebuild the forms as real HTML tables. Do not reproduce the scanned pages.
- Long entries grow and flow across pages rather than being cut off.
- Includes the disclaimer on every page.
- Warns before printing that a saved PDF is readable by anyone who has it.

### Content from the handout

**Owner** has permission to use the handout's wording. All instructions, definitions, lists, prayers, and checklist items come from `reference/QuickStepsWeek1Handouts.pdf`.

**Builder's call:**

- Correct obvious typos, such as "teach people hot to treat me," "I have for had no control," and "Step S." Some right-hand text on p. 6 is cut off and needs completing, so flag these for the owner's review.
- Don't reuse the filled-in examples on handout pp. 3, 9, and 12, which may describe real people. Any examples must be newly written.

Keep content in data files, separate from code, so wording can change without touching app logic.

## Quality requirements

- WCAG 2.2 AA, including full keyboard and screen reader support.
- Light and dark themes that follow the system setting.
- Inputs at 16px or larger, so iOS doesn't zoom, with comfortable tap targets and no horizontal scrolling on a phone.
- Latest two versions of Safari (iOS and macOS), Chrome (Android and desktop), Firefox, and Edge.
- Calm, plain, non-clinical tone. The screen should feel private and steady, without streaks, badges, or celebratory effects.

Automated tests must cover at least: no off-origin or post-load requests, security headers, encrypted save and restore, wrong password handling, tampered and malformed files, column order, a full phone-sized run through each inventory, and print output.

## Left to the builder

- Framework and tooling, keeping dependencies few, since each one is something to trust. Static output only.
- Visual design, within the tone above. The mockup colors are not a decision.
- Internal storage mechanism and schema.
- Exact wording of interface text not specified above.
- Which column-by-column screens can show several entries at once, where that's easier than one at a time.
- Site name, domain, and feedback contact are not yet decided. Use placeholders that can be changed in one place, and ask the owner for them before launch.
