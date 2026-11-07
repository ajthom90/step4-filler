import { test as base, expect, type Page } from '@playwright/test'
import { emptyDoc, type InventoryDoc } from '../../src/core/doc'

/**
 * Test harness that enforces the site's security policy. Every e2e test uses
 * this `test`, and it fails the test on:
 *  - any request to another origin,
 *  - any request after load other than the allow-list below,
 *  - any CSP violation,
 *  - any uncaught page error.
 * `blob:`, `data:` and `about:` URLs never leave the device and are ignored.
 */

/** Paths that may be requested after the page has loaded. */
export const POST_LOAD_ALLOWED = [
  /^\/manifest\.webmanifest$/,
  /^\/icon[^/]*$/,
  /^\/step4-inventory-offline\.html$/, // the user-initiated offline file download
]

export type Guard = {
  /** Off-origin requests and post-load requests outside the allow-list. */
  leaks: string[]
  /** CSP violations, as "directive blockedURI". */
  violations: string[]
  /** Uncaught page errors. */
  pageErrors: string[]
}

type Options = {
  /**
   * Explicit opt-out used only by the harness self-tests, which provoke the
   * guard on purpose and assert on `guard` instead of failing.
   */
  expectGuardTrips: boolean
}

const LOCAL_SCHEMES = ['blob:', 'data:', 'about:']

export const test = base.extend<{ guard: Guard } & Options>({
  expectGuardTrips: [false, { option: true }],

  guard: [
    async ({ page, baseURL, expectGuardTrips }, use) => {
      const origin = new URL(baseURL ?? 'http://127.0.0.1:4173').origin
      const guard: Guard = { leaks: [], violations: [], pageErrors: [] }
      let loaded = false

      page.on('request', (request) => {
        const url = new URL(request.url())
        if (LOCAL_SCHEMES.includes(url.protocol)) return
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
          loaded = false
        }
        if (url.origin !== origin) {
          guard.leaks.push(`off-origin: ${request.url()}`)
          return
        }
        if (loaded && !POST_LOAD_ALLOWED.some((re) => re.test(url.pathname))) {
          guard.leaks.push(`post-load: ${request.url()}`)
        }
      })
      page.on('load', () => {
        loaded = true
      })
      page.on('pageerror', (error) => guard.pageErrors.push(error.message))

      await page.exposeBinding('__reportViolation', (_source, report: string) => {
        guard.violations.push(report)
      })
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          ;(window as unknown as { __reportViolation: (r: string) => void }).__reportViolation(
            `${event.effectiveDirective} ${event.blockedURI}`,
          )
        })
      })

      await use(guard)

      if (!expectGuardTrips) {
        expect(guard.leaks, 'requests that must never happen').toEqual([])
        expect(guard.violations, 'CSP violations').toEqual([])
        expect(guard.pageErrors, 'uncaught page errors').toEqual([])
      }
    },
    { auto: true },
  ],
})

export { expect }

const STORAGE_KEY = 'step4-inventory'

/**
 * Seeds a plain browser save and opens home, so flow tests are not interrupted by the
 * save prompt. The seed is written only when nothing is stored yet, so a reload keeps
 * whatever the test has typed since.
 */
export async function startWithBrowserSave(page: Page, doc: Partial<InventoryDoc> = {}): Promise<void> {
  const seeded: InventoryDoc = { ...emptyDoc('alcohol', { kind: 'god', custom: '' }), ...doc }
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    [STORAGE_KEY, JSON.stringify(seeded)],
  )
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
}
