import { site } from '../../site.config'
import { expect, test } from './fixtures'

const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; manifest-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"

test('serves the exact security headers', async ({ request }) => {
  const response = await request.get('/')
  const headers = response.headers()
  expect(headers['content-security-policy']).toBe(CSP)
  expect(headers['referrer-policy']).toBe('no-referrer')
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['strict-transport-security']).toContain('max-age=31536000')
  const permissions = headers['permissions-policy']
  expect(permissions).toContain('camera=()')
  expect(permissions).toContain('microphone=()')
  expect(permissions).toContain('geolocation=()')
})

test('app renders with no violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#app')).not.toBeEmpty()
})

test('manifest allows adding to the home screen', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest')
  expect(response.ok()).toBe(true)
  const manifest = await response.json()
  expect(manifest.display).toBe('standalone')
  expect(manifest.name).toBe(site.name)
})

test.describe('the guard itself', () => {
  test.use({ expectGuardTrips: true })

  test('the harness catches a leak', async ({ page, guard }) => {
    // The app's CSP would block this image before any request is made, so use
    // a page without a CSP. Abort it so nothing really leaves the machine.
    await page.route('https://example.com/**', (route) => route.abort())
    await page.goto('about:blank')
    await page.setContent('<div></div>')
    await page.evaluate(() => {
      const img = document.createElement('img')
      img.src = 'https://example.com/x.png'
      document.body.append(img)
    })
    await expect.poll(() => guard.leaks).toContain('off-origin: https://example.com/x.png')
  })

  test('the app blocks the same image with CSP and the guard records it', async ({ page, guard }) => {
    await page.goto('/')
    await page.evaluate(() => {
      const img = document.createElement('img')
      img.src = 'https://example.com/x.png'
      document.body.append(img)
    })
    await expect.poll(() => guard.violations.join('\n')).toContain('img-src')
  })

  test('the harness catches a violation', async ({ page, guard }) => {
    await page.goto('/')
    await page.evaluate(() => {
      const script = document.createElement('script')
      script.textContent = 'window.__ran = true'
      document.body.append(script)
    })
    await expect.poll(() => guard.violations.join('\n')).toContain('script-src')
    expect(await page.evaluate(() => (window as unknown as { __ran?: boolean }).__ran)).toBeUndefined()
  })
})
