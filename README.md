# Step 4 Inventory

A website for working through a Step 4 inventory (resentments, fears, and sex conduct and harms) one column at a time. It follows a fixed handout method, offers the flaws and assets checklist and an optional abstinence pledge, and prints each form in a paper layout.

It is a static site. It has no server, no accounts, no analytics, and no database. Everything a person writes stays in their browser.

## Not affiliated

Not affiliated with Alcoholics Anonymous, Overeaters Anonymous, or any 12-step program. This site does not replace a sponsor or professional help.

## Privacy model

- What you write is never sent anywhere. The page makes no requests after it loads, except the offline file download you start yourself. Tests fail on any request to another origin.
- Nothing is saved until the person chooses how. They can keep it in the browser, optionally behind a password (AES-256-GCM, with a key made from the password by PBKDF2-SHA-256 at 600,000 iterations, using the browser's Web Crypto), or download a file, with or without a password. A forgotten password cannot be recovered or reset.
- There are no third-party scripts, fonts, or styles, and no service worker. A strict Content-Security-Policy, set in `public/_headers`, blocks everything but the site's own files, and blocks all connections.
- `preact` is the only runtime dependency.
- A single-file offline version is built for computers. It carries its own policy and makes no requests.

### What this site cannot protect against

- **Browser extensions.** An extension that can read pages can read an inventory while it is on screen.
- **A device someone else can open.** Anyone who can use the device and the browser can read a readable save, and can open the site while it is unlocked. A password protects the saved copy, not an open page.
- **Downloaded and printed copies.** A downloaded file or a printed or saved PDF is outside the site's control. It may be copied into cloud backups or sit in a Downloads folder, and a readable copy can be read by anyone who has it.

### Hosting

The site is delivered by Cloudflare Pages. Like any website, the host handles visitors' IP addresses to deliver pages under its own policies. This project does not claim otherwise, and does not claim that no IP addresses are logged. See `docs/launch-checklist.md` for the review of what the account actually exposes.

## Run it

Requires Node.js and npm.

```
npm ci
npm run build        # builds dist/, including dist/step4-inventory-offline.html
npx playwright install   # once, to fetch the test browsers
```

To look at it, serve `dist/` with the same headers production uses:

```
node scripts/serve-dist.mjs   # http://127.0.0.1:4173
```

## Test it

```
npm run typecheck
npm test            # unit tests
npm run test:e2e    # builds, then runs browser tests on Chromium, Firefox, WebKit, a Pixel 7 and an iPhone 14
```

The browser tests include accessibility checks (axe, WCAG 2.2 A and AA, in light and dark), keyboard use, field size and tap targets, and a privacy sweep that follows a typed value through every request and scans the build for outside references.

## Configure it

The site name, domain, feedback link, and Big Book link live only in `site.config.ts`.

## Deploy it

Deployment is the owner's action. See `docs/deploy.md` and `docs/launch-checklist.md`.

## Do not commit `reference/`

`reference/` holds the source handout and is for local use only. It is git-ignored: never commit it, and do not make the repository public until you have checked that it is not in the history. Do not commit `.superpowers/` either.
