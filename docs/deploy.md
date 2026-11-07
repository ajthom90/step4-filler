# Deploying to Cloudflare Pages

Deployment is the owner's action. Nothing in this repository deploys itself, and nothing here has been run against a Cloudflare account.

## Before you deploy

1. Set the site name, domain, feedback link, and Big Book link in `site.config.ts`. They live only there.
2. Work through `docs/launch-checklist.md`.
3. Check the build locally:

   ```
   npm ci
   npm run typecheck && npm test && npm run test:e2e
   ```

   `npm run test:e2e` builds the site first and serves `dist/` with the rules from `public/_headers`, so the tests see the same headers production should send.

## Create the Pages project

1. In the Cloudflare dashboard, open Workers & Pages and create a Pages project. Connect the Git repository, or use a direct upload of `dist/`.
2. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: set `NODE_VERSION` to the version you use locally if the default is older.
3. `npm run build` runs `vite build` and then `scripts/build-offline.mjs`, which writes `dist/step4-inventory-offline.html`. Both must be in the output.
4. Add your custom domain under the project's Custom domains tab.

## Settings that must stay off

These products inject code or collect data. The Content-Security-Policy would block injected scripts, but they should not be on at all:

- Web Analytics (including the one-click "enable" on the Pages project)
- Zaraz
- Rocket Loader
- Email Address Obfuscation (Scrape Shield)

Also leave Auto Minify and any "Cloudflare Apps" or Workers that rewrite HTML off for this site. Do not add a service worker.

## Confirm the live response

After the first deploy, fetch the live site and compare. Do this for the home page and for the offline file:

```
curl -sI https://YOUR-DOMAIN/ 
curl -sI https://YOUR-DOMAIN/step4-inventory-offline.html
```

The home page response must carry these headers, with these values (they come from `public/_headers`):

```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; manifest-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
```

The offline file must also carry `Content-Disposition: attachment; filename="step4-inventory-offline.html"`.

Then open the site in a browser with the developer tools open:

- The Network tab shows only the page, its one script, its one stylesheet, the manifest, and the icon. No other host appears.
- The Console shows no Content-Security-Policy violation.
- View the page source and confirm Cloudflare added no script or comment-wrapped tag to it.

If a header is missing or different, or anything extra appears in the page, fix it before sharing the link.

## `includeSubDomains`

The Strict-Transport-Security header includes `includeSubDomains`. Once a browser has seen it, every subdomain of the domain must be reachable over HTTPS for a year. Decide whether that is right for the domain you chose, and remove it from `public/_headers` if other subdomains exist that are not ready for HTTPS.
