# Launch checklist

For the owner. Nothing here is done yet.

## Names and links

- [ ] Choose a site name, domain, and feedback contact, then set them in `site.config.ts`.
- [ ] Confirm that `bigBookUrl` is the right link and that it works.
- [ ] Review `https://findahelpline.com`, the support page's local-services link, and its `sms:988` link. Confirm they are right for the people you expect, and that you are comfortable linking to them.

## Wording

- [ ] Review `docs/content-review.md`.
- [ ] Review the privacy statement against what the Cloudflare account actually exposes to you, and change the wording so it stays true. The site must never claim that no IP addresses are logged.
- [ ] Review the narcotics and sex-and-love presets' draft label and wording, and line up reviewers from those fellowships. Launch does not wait for them, but the presets stay marked as draft until they have looked.

## Real devices

- [ ] On a real iPhone and a real Android phone: run an inventory, save it in the browser, close and reopen it, download a file, open that file, and print (or save as PDF).
- [ ] Add the site to the home screen on each, and check that the saved data is still there afterward. Then add what actually happens to the save screen's wording. The specification requires this, and nothing on the site claims it yet. Do not promise protection from Safari's deletion of site data unless the test shows it.
- [ ] Try the offline file on both phones and on a computer, and update the offline wording to what actually happens. The site currently says the file has not been tested on phones. The offline file deliberately never uses browser storage (other local files can share it in some browsers), so confirm that its wording about saving only to files reads clearly.
- [ ] In real Safari on macOS and on iOS, check the keyboard: Tab (with the Safari setting that lets Tab reach every control, and with Option+Tab) to the radio choices and buttons, and complete a whole entry. Automated tests skip this in WebKit because Safari's own setting decides whether Tab reaches radios and buttons.
- [ ] Print from Firefox and Safari as well as Chromium (only Chromium has been verified). Check that the disclaimer repeats on every page, and that the landscape forms print acceptably.

## Cloudflare

- [ ] After the first deploy, confirm the live headers match `public/_headers` (see `docs/deploy.md`).
- [ ] Keep Web Analytics, Zaraz, Rocket Loader, and email obfuscation off.
- [ ] Decide on `includeSubDomains` in the Strict-Transport-Security header in `public/_headers`. It applies to every other subdomain on the chosen domain.

## Release

- [x] License: MIT (`LICENSE`, and the `license` field in `package.json`).
- [x] Repository made public on 2026-11-07, after checking that nothing in `reference/` or `.superpowers/` was ever committed and that the handout is not in the history.
