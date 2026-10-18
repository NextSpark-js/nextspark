#!/usr/bin/env node
/**
 * Browser check of cookie consent (#272) on a built NextSpark project.
 *
 *   node scripts/consent/consent-browser-check.mjs --app <built project dir> [--port 4790] [--json <out file>]
 *        [--skip-strict] [--fail-on serious,critical]
 *
 * The project is built with consent on, both loaders configured and, for the strict-CSP part, the request-time root
 * layout and its nonce (legacy ISR, `security: { cspNonce: true }` in app.config):
 *
 *   NEXT_PUBLIC_CONSENT_ENABLED=true NEXT_PUBLIC_PLAUSIBLE_DOMAIN=example.com NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST123 \
 *     pnpm build
 *
 * It starts the project (`next start`) and drives Chromium (Playwright) through the public pages:
 *  - before the visitor chooses, and after Reject all, no request to Plausible or Google leaves the browser, and no
 *    loader script is in the page; after Accept all (or a per-category choice with analytics on) there is one to each;
 *  - the choice survives a reload, fires `nextspark:consent`, and can be reopened and revoked from the footer link;
 *  - the banner takes no space in the page, and axe finds no serious or critical WCAG violation with it shown;
 *  - behind a strict nonce policy (`script-src 'nonce-…' 'strict-dynamic'`, added by a small reverse proxy that does what
 *    a project's `config/hooks/proxy.ts` does) the banner and the loaders run with no CSP violation.
 *
 * No real request goes to a vendor: every request to a vendor host is answered by the browser itself (Playwright's
 * `route`) with a stub, and counted. Exit 0 when every check passes, 1 when one fails, 2 on a usage or environment error.
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import http from 'node:http'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { blocking, rowsFromAxe, waitFor } from '../accessibility/axe-scan.mjs'

const GA_ID = 'G-TEST123'
const VENDOR = /^https?:\/\/([^/]+\.)?(plausible\.io|googletagmanager\.com|google-analytics\.com|analytics\.google\.com)(\/|$)/
const COOKIE = 'nextspark_consent'
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** Whether `url` is a request to an analytics vendor the check must keep off the network. */
export const isVendorUrl = (url) => VENDOR.test(url)

/** Which vendor `url` belongs to: `plausible`, `google`, or null. */
export const vendorOf = (url) => (!isVendorUrl(url) ? null : /plausible\.io/.test(url) ? 'plausible' : 'google')

/** The choice a consent cookie value holds (`g`, the granted optional categories), or null when it cannot be read. */
export function grantedIn(cookieValue) {
  try {
    const value = JSON.parse(decodeURIComponent(cookieValue))
    return Array.isArray(value.g) ? value.g : null
  } catch {
    return null
  }
}

/** The strict nonce policy a project's request hook would send: nothing but nonce'd scripts (and what they load). */
export const strictPolicy = (nonce) =>
  [
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "object-src 'none'",
    "base-uri 'self'",
    "connect-src 'self' https://plausible.io https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  ].join('; ')

/**
 * A reverse proxy in front of `target` that does what `config/hooks/proxy.ts` does for a nonce policy: a nonce per request,
 * forwarded as `x-nonce` and in the request's `content-security-policy` (Next reads it to nonce its own scripts), and the
 * policy added to the response next to the one next.config sends.
 */
export function startNonceProxy(port, target) {
  const nonces = []
  const server = http.createServer((req, res) => {
    const nonce = randomBytes(16).toString('base64')
    const policy = strictPolicy(nonce)
    nonces.push(nonce)
    const upstream = http.request(
      { host: '127.0.0.1', port: target, method: req.method, path: req.url, headers: { ...req.headers, 'x-nonce': nonce, 'content-security-policy': policy } },
      (response) => {
        const headers = { ...response.headers }
        const existing = headers['content-security-policy']
        headers['content-security-policy'] = existing ? [].concat(existing, policy) : policy
        res.writeHead(response.statusCode ?? 502, headers)
        response.pipe(res)
      },
    )
    upstream.on('error', () => res.writeHead(502).end())
    req.pipe(upstream)
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve({ server, nonces }))
  })
}

async function main() {
  const { values } = parseArgs({
    options: {
      app: { type: 'string' },
      port: { type: 'string', default: '4790' },
      json: { type: 'string' },
      'skip-strict': { type: 'boolean', default: false },
      'fail-on': { type: 'string', default: 'serious,critical' },
    },
  })
  if (!values.app) {
    console.error('usage: consent-browser-check.mjs --app <built project dir> [--port 4790] [--json <file>] [--skip-strict] [--fail-on serious,critical]')
    process.exit(2)
  }
  const port = Number(values.port)
  const base = `http://localhost:${port}`
  const strictBase = `http://localhost:${port + 1}`
  const failOn = values['fail-on'].split(',')
  const checks = []
  const check = (name, ok, detail = '') => {
    checks.push({ name, ok: Boolean(ok), detail })
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  }
  const axeRows = []
  let serverProc, proxy, browser
  let serverLog = ''
  try {
    const { chromium } = await import('playwright')
    const { default: AxeBuilder } = await import('@axe-core/playwright')
    const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')

    const app = path.resolve(values.app)
    const nextBin = path.join(app, 'node_modules/next/dist/bin/next')
    if (!existsSync(nextBin)) throw new Error(`${nextBin} not found: --app must be an installed, built project`)
    serverProc = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(port)], {
      cwd: app,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production', BETTER_AUTH_URL: base, NEXT_PUBLIC_APP_URL: base },
    })
    serverProc.stdout.on('data', (c) => (serverLog += c))
    serverProc.stderr.on('data', (c) => (serverLog += c))
    if (!(await waitFor(`${base}/login`, 120_000))) throw new Error('the project did not start')
    if (!values['skip-strict']) proxy = await startNonceProxy(port + 1, port)

    browser = await chromium.launch()

    /** A fresh visitor: its own cookies, every vendor request answered by a stub and recorded, CSP violations recorded. */
    const visitor = async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
      const requests = []
      await context.route((url) => isVendorUrl(url.href), (route) => {
        const url = route.request().url()
        requests.push(url)
        if (/\.js(\?|$)|\/gtag\/js/.test(url)) {
          const marker = vendorOf(url) === 'plausible' ? '__plausibleStub' : '__gtagStub'
          return route.fulfill({ status: 200, contentType: 'text/javascript', body: `window.${marker}=(window.${marker}||0)+1` })
        }
        return route.fulfill({ status: 204, body: '' })
      })
      const page = await context.newPage()
      const violations = []
      page.on('console', (m) => /Content Security Policy|Refused to (load|execute|connect|apply)/i.test(m.text()) && violations.push(m.text()))
      await page.addInitScript(() => {
        window.__consentEvents = []
        window.addEventListener('nextspark:consent', (e) => window.__consentEvents.push(e.detail))
        document.addEventListener('securitypolicyviolation', (e) => console.error(`Content Security Policy violation: ${e.violatedDirective} ${e.blockedURI}`))
      })
      return { context, page, requests, violations }
    }
    const settle = (page) => page.waitForTimeout(1500)
    const cookieOf = async (context) => (await context.cookies()).find((c) => c.name === COOKIE)
    const count = (requests, vendor) => requests.filter((u) => vendorOf(u) === vendor).length
    const banner = (page) => page.locator('[data-cy="consent-banner"]')
    const scan = async (page, name) => {
      const results = await new AxeBuilder({ page, axeSource }).withTags([...WCAG_TAGS, 'best-practice']).analyze()
      const rows = rowsFromAxe(name, results)
      axeRows.push(...rows)
      const blockers = blocking(rows, failOn)
      check(`axe: ${name} has no ${failOn.join('/')} WCAG violation`, blockers.length === 0, `${rows.length} finding(s)${blockers.length ? `: ${blockers.map((r) => r.rule).join(', ')}` : ''}`)
    }

    // ---- the project's own CSP (next.config) ----
    {
      const { context, page, requests, violations } = await visitor()
      await page.goto(`${base}/`, { waitUntil: 'networkidle' })
      await banner(page).waitFor({ timeout: 30_000 })
      await settle(page)
      check('no choice yet: the banner is shown', await banner(page).isVisible())
      check('no choice yet: no request to Plausible or Google', requests.length === 0, `${requests.length} request(s)`)
      check('no choice yet: no loader script in the page', (await page.locator('script[data-nextspark-consent]').count()) === 0)
      check('no choice yet: no consent cookie', !(await cookieOf(context)))

      const heightWith = await page.evaluate(() => document.documentElement.scrollHeight)
      const fixed = await banner(page).evaluate((el) => getComputedStyle(el.parentElement).position)
      check('the banner is fixed to the window: it takes no space in the page', fixed === 'fixed')

      await scan(page, '/ with the banner')
      await page.locator('[data-cy="consent-settings-toggle"]').click()
      await page.locator('[data-cy="consent-settings"]').waitFor()
      await scan(page, '/ with the banner and its settings open')
      check('the banner and its settings have no inline style and no inline script', (await page.locator('[data-cy="consent-banner"] [style], [data-cy="consent-banner"][style]').count()) === 0 && (await page.locator('script[data-nextspark-consent]:not([src])').count()) === 0)
      await page.locator('[data-cy="consent-settings-toggle"]').click()

      await page.reload({ waitUntil: 'networkidle' })
      await banner(page).waitFor()
      await settle(page)
      check('reload without choosing: still no request to a vendor', requests.length === 0, `${requests.length} request(s)`)

      await page.locator('[data-cy="consent-reject"]').click()
      await settle(page)
      check('Reject all: the banner closes', !(await banner(page).isVisible()))
      check('Reject all: the page height did not change', (await page.evaluate(() => document.documentElement.scrollHeight)) === heightWith)
      const rejected = await cookieOf(context)
      check('Reject all: the cookie is first-party, SameSite=Lax, 6 to 12 months, with nothing granted',
        rejected && rejected.sameSite === 'Lax' && rejected.path === '/' && (rejected.expires - Date.now() / 1000) / 86400 > 179 && (rejected.expires - Date.now() / 1000) / 86400 < 366 && JSON.stringify(grantedIn(rejected.value)) === '[]',
        rejected ? `sameSite=${rejected.sameSite} secure=${rejected.secure} g=${JSON.stringify(grantedIn(rejected.value))}` : 'no cookie')
      check('Reject all: no request to a vendor', requests.length === 0, `${requests.length} request(s)`)
      const rejectEvent = await page.evaluate(() => window.__consentEvents.at(-1))
      check('Reject all: nextspark:consent fired with nothing optional granted', rejectEvent && rejectEvent.hasChosen && !rejectEvent.categories.analytics && !rejectEvent.categories.marketing)
      await page.reload({ waitUntil: 'networkidle' })
      await settle(page)
      check('reload after Reject all: no banner and still no request to a vendor', !(await banner(page).isVisible()) && requests.length === 0, `${requests.length} request(s)`)

      // reopen from the footer link, then grant per category
      const link = page.locator('[data-cy="consent-open"]')
      await link.waitFor()
      await link.focus()
      await link.click()
      await banner(page).waitFor()
      check('the footer link reopens the settings and moves focus to the banner', await banner(page).evaluate((el) => el === document.activeElement))
      check('reopened: analytics shows as off', !(await page.locator('[data-cy="consent-switch-analytics"]').isChecked()))
      await page.keyboard.press('Escape')
      check('Escape closes the reopened banner and returns focus to the footer link', !(await banner(page).isVisible()) && (await link.evaluate((el) => el === document.activeElement)))

      await link.click()
      await page.locator('[data-cy="consent-switch-analytics"]').click()
      await page.locator('[data-cy="consent-save"]').click()
      await settle(page)
      const partial = await cookieOf(context)
      check('Settings: only analytics on is stored', JSON.stringify(grantedIn(partial?.value ?? '')) === '["analytics"]', partial ? JSON.stringify(grantedIn(partial.value)) : 'no cookie')
      check('Settings: analytics on loads both loaders', count(requests, 'plausible') >= 1 && count(requests, 'google') >= 1, `plausible ${count(requests, 'plausible')}, google ${count(requests, 'google')}`)
      const consentCalls = await page.evaluate(() => (window.dataLayer ?? []).map((e) => Array.from(e)).filter((e) => e[0] === 'consent'))
      check('Settings: Google consent mode has analytics granted and ads denied', consentCalls.some((c) => c[2]?.analytics_storage === 'granted' && c[2]?.ad_storage === 'denied'), JSON.stringify(consentCalls))

      // revoke from the footer link
      await link.click()
      await page.locator('[data-cy="consent-switch-analytics"]').click()
      await page.locator('[data-cy="consent-save"]').click()
      await settle(page)
      const flags = await page.evaluate((id) => ({ plausible: localStorage.getItem('plausible_ignore'), ga: window[`ga-disable-${id}`], last: (window.dataLayer ?? []).map((e) => Array.from(e)).filter((e) => e[0] === 'consent').at(-1) }), GA_ID)
      check('revoke: Plausible is told to ignore this browser', flags.plausible === 'true')
      check('revoke: Google is disabled and consent mode is denied', flags.ga === true && flags.last?.[2]?.analytics_storage === 'denied', JSON.stringify(flags.last))
      check('revoke: the cookie stores nothing granted', JSON.stringify(grantedIn((await cookieOf(context))?.value ?? '')) === '[]')

      await context.close()
      check('the project CSP (next.config, loader origins from NEXT_PUBLIC_*): no violation', violations.length === 0, violations.slice(0, 2).join(' | '))
    }

    // ---- Accept all ----
    {
      const { context, page, requests, violations } = await visitor()
      await page.goto(`${base}/`, { waitUntil: 'networkidle' })
      await banner(page).waitFor({ timeout: 30_000 })
      await page.locator('[data-cy="consent-accept"]').click()
      await settle(page)
      check('Accept all: one request to Plausible', count(requests, 'plausible') >= 1, `${count(requests, 'plausible')}`)
      check('Accept all: one request to Google', count(requests, 'google') >= 1, `${count(requests, 'google')}`)
      check('Accept all: the stubs ran', await page.evaluate(() => Boolean(window.__plausibleStub && window.__gtagStub)))
      const event = await page.evaluate(() => window.__consentEvents.at(-1))
      check('Accept all: nextspark:consent fired with every category', event?.hasChosen && event.categories.analytics && event.categories.marketing)
      check('Accept all: the banner closes', !(await banner(page).isVisible()))
      const before = requests.length
      await page.reload({ waitUntil: 'networkidle' })
      await settle(page)
      check('reload after Accept all: no banner, and the loaders load again', !(await banner(page).isVisible()) && requests.length > before, `${requests.length - before} new request(s)`)
      await context.close()
      check('Accept all: no CSP violation under the project CSP', violations.length === 0, violations.slice(0, 2).join(' | '))
    }

    // ---- a strict nonce policy ----
    if (proxy) {
      const { context, page, requests, violations } = await visitor()
      const response = await page.goto(`${strictBase}/`, { waitUntil: 'networkidle' })
      const policy = (await response.allHeaders())['content-security-policy'] ?? ''
      check('strict: the response carries the nonce policy', /script-src 'nonce-[^']+' 'strict-dynamic'/.test(policy))
      await banner(page).waitFor({ timeout: 30_000 })
      await settle(page)
      check('strict: the banner is shown', await banner(page).isVisible())
      check('strict: before the choice no request to a vendor', requests.length === 0, `${requests.length} request(s)`)
      await page.locator('[data-cy="consent-accept"]').click()
      await settle(page)
      check('strict: after Accept all each loader ran (its nonce\'d script executed)', await page.evaluate(() => Boolean(window.__plausibleStub && window.__gtagStub)))
      const nonceInfo = await page.evaluate(() => ({
        themeNonce: document.querySelector('script[nonce]')?.nonce ?? '',
        loaders: [...document.querySelectorAll('script[data-nextspark-consent]')].map((s) => s.nonce),
      }))
      check('strict: the loader scripts carry the request nonce', nonceInfo.loaders.length === 2 && nonceInfo.loaders.every((n) => n && n === nonceInfo.themeNonce), JSON.stringify(nonceInfo))
      check('strict: no CSP violation with the banner and both loaders', violations.length === 0, violations.slice(0, 3).join(' | '))
      // control: the detector does see a violation, so the check above could have failed
      await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<img alt="" src="data:," onerror="window.__noNonce=1">'))
      await settle(page)
      check('strict: control, an inline handler the policy does not allow is reported', violations.length >= 1 && !(await page.evaluate(() => window.__noNonce)), `${violations.length} violation(s)`)
      await context.close()
    }
  } catch (error) {
    console.error(`consent-browser-check: ${error.message}${serverLog ? `\n--- server log ---\n${serverLog.slice(-3000)}` : ''}`)
    process.exitCode = 2
    return
  } finally {
    await browser?.close()
    proxy?.server.close()
    serverProc?.kill()
  }

  const failed = checks.filter((c) => !c.ok)
  if (values.json) writeFileSync(values.json, JSON.stringify({ checks, axe: axeRows }, null, 2) + '\n')
  console.log(`${checks.length - failed.length}/${checks.length} checks passed`)
  if (failed.length) process.exitCode = 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main().catch((error) => {
    console.error(`consent-browser-check: ${error.message}`)
    process.exitCode = 2
  })
}
