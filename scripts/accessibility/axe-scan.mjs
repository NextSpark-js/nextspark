#!/usr/bin/env node
/**
 * axe scan of a built NextSpark starter project.
 *
 * Starts the project (`next start`) together with a local stand-in for the Resend API, signs a throwaway user in with
 * an email OTP read from that stand-in, creates one task, and runs axe-core (WCAG 2.0/2.1/2.2 A and AA rules) through
 * Playwright on the public pages, the signed-in dashboard pages and the task create, detail and edit pages.
 *
 *   node scripts/accessibility/axe-scan.mjs --app <built project dir> [--port 3990] [--json <out file>]
 *        [--fail-on serious,critical]
 *
 * The project needs a migrated database (DATABASE_URL in its .env) and a production build made with
 * NEXTSPARK_AUTH_RUNTIME_ONLY=email,google. Exit 0 when no violation has an impact in --fail-on, 1 when one has,
 * 2 on a usage or environment error. Every violation (any impact) goes to the --json report.
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

// WCAG 2.0/2.1/2.2 A and AA decide the exit code; axe's best-practice rules are reported alongside, never blocking
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const TAGS = [...WCAG_TAGS, 'best-practice']
const TASK_TITLE = 'Axe scan task'
const IMPACTS = ['critical', 'serious', 'moderate', 'minor']

/** Violations of `results` as flat rows, one per failing node. */
export function rowsFromAxe(page, results) {
  return results.violations.flatMap((v) =>
    v.nodes.map((n) => ({ page, impact: v.impact ?? 'minor', rule: v.id, wcag: v.tags.some((t) => WCAG_TAGS.includes(t)), target: n.target.join(' '), help: v.help, html: n.html.slice(0, 300), summary: n.failureSummary }))
  )
}

/** The WCAG rows whose impact is in `failOn`. */
export function blocking(rows, failOn) {
  return rows.filter((r) => r.wcag && failOn.includes(r.impact))
}

/** Counts by impact, every impact present. */
export function countByImpact(rows) {
  return Object.fromEntries(IMPACTS.map((i) => [i, rows.filter((r) => r.impact === i).length]))
}

/** The local Resend stand-in: keeps what was sent so the OTP can be read back. */
function startFakeResend(port) {
  const mails = []
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    if (req.method === 'GET' && url.pathname === '/last') {
      const m = [...mails].reverse().find((x) => JSON.stringify(x.to).includes(url.searchParams.get('to') ?? ''))
      res.writeHead(m ? 200 : 404, { 'content-type': 'application/json' })
      return res.end(JSON.stringify(m ?? null))
    }
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      try { mails.push(JSON.parse(body)) } catch { /* not JSON: ignored */ }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ id: `fake-${mails.length}` }))
    })
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve({ server, mails }))
  })
}

async function waitFor(url, ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(5000) })).ok) return true } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

async function main() {
  const { values } = parseArgs({
    options: {
      app: { type: 'string' },
      port: { type: 'string', default: '3990' },
      json: { type: 'string' },
      'fail-on': { type: 'string', default: 'serious,critical' },
    },
  })
  if (!values.app) {
    console.error('usage: axe-scan.mjs --app <built project dir> [--port 3990] [--json <file>] [--fail-on serious,critical]')
    process.exit(2)
  }
  const failOn = values['fail-on'].split(',')
  const port = Number(values.port)
  const resendPort = port + 1
  const base = `http://localhost:${port}`
  const email = 'axe-scan@example.com'

  const rows = []
  const scanned = []
  let axeVersion
  let resend, serverProc, browser
  let serverLog = ''
  try {
    const { chromium } = await import('playwright')
    const { default: AxeBuilder } = await import('@axe-core/playwright')
    // The axe-core pinned in the root package.json, not the copy @axe-core/playwright depends on
    const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')

    resend = await startFakeResend(resendPort)
    const app = path.resolve(values.app)
    const nextBin = path.join(app, 'node_modules/next/dist/bin/next')
    if (!existsSync(nextBin)) throw new Error(`${nextBin} not found: --app must be an installed, built project`)
    serverProc = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(port)], {
      cwd: app,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        BETTER_AUTH_URL: base,
        NEXT_PUBLIC_APP_URL: base,
        NEXTSPARK_AUTH_RUNTIME_ONLY: 'email,google',
        RESEND_API_KEY: 're_axescanaxescanaxescanaxescan',
        RESEND_FROM_EMAIL: 'noreply@example.com',
        RESEND_BASE_URL: `http://127.0.0.1:${resendPort}`,
      },
    })
    serverProc.stdout.on('data', (c) => (serverLog += c))
    serverProc.stderr.on('data', (c) => (serverLog += c))

    if (!(await waitFor(`${base}/login`, 120_000))) throw new Error('the project did not start')
    browser = await chromium.launch()
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()

    // `ready` finds something the page shows only once its client-side data has loaded; axe must not run on the
    // loading state (the task forms and the lists fetch after `networkidle`)
    const scanPage = async (name, { disableRules = [] } = {}) => {
      const results = await new AxeBuilder({ page, axeSource }).withTags(TAGS).disableRules(disableRules).analyze()
      axeVersion = results.testEngine.version
      const found = rowsFromAxe(name, results)
      rows.push(...found)
      scanned.push({ page: name, url: page.url(), violations: found.length })
      console.log(`${name}: ${found.length} violation node(s)`)
    }
    const scan = async (name, url, ready) => {
      await page.goto(url.startsWith('http') ? url : base + url, { waitUntil: 'networkidle' })
      if (ready) await ready(page).first().waitFor({ timeout: 30_000 })
      await scanPage(name)
    }

    for (const p of ['/', '/login', '/signup', '/forgot-password']) await scan(p, p)

    // Sign in by OTP, the way the login form does, but through the API so the scan starts signed in.
    const headers = { origin: base, 'content-type': 'application/json' }
    const send = await context.request.post(`${base}/api/auth/email-otp/send-verification-otp`, {
      headers, data: { email, type: 'sign-in' },
    })
    if (!send.ok()) throw new Error(`send OTP -> ${send.status()}`)
    const mail = resend.mails.at(-1)
    const otp = /^(\d{6})\b/.exec(mail?.subject ?? '')?.[1]
    if (!otp) throw new Error('no OTP in the stand-in Resend mail')
    const signIn = await context.request.post(`${base}/api/auth/sign-in/email-otp`, { headers, data: { email, otp } })
    if (!signIn.ok()) throw new Error(`sign in -> ${signIn.status()}`)

    const teams = await (await context.request.get(`${base}/api/v1/teams`)).json()
    const teamId = teams.data?.[0]?.id
    if (!teamId) throw new Error('the signed-in user has no team')
    const created = await context.request.post(`${base}/api/v1/tasks`, {
      headers: { ...headers, 'x-team-id': teamId },
      data: { title: TASK_TITLE, status: 'todo' },
    })
    const taskId = (await created.json()).data?.id
    if (!taskId) throw new Error(`create task -> ${created.status()}`)

    for (const [name, url, ready] of [
      ['/dashboard', '/dashboard', (p) => p.getByText('My Tasks')],
      ['/dashboard/tasks', '/dashboard/tasks', (p) => p.getByText(TASK_TITLE)],
      ['/dashboard/tasks/create', '/dashboard/tasks/create', (p) => p.getByRole('textbox', { name: /title/i })],
      ['/dashboard/tasks/[id]', `/dashboard/tasks/${taskId}`, (p) => p.getByText(TASK_TITLE)],
      ['/dashboard/tasks/[id]/edit', `/dashboard/tasks/${taskId}/edit`, (p) => p.getByRole('textbox', { name: /title/i })],
      ['/dashboard/settings/profile', '/dashboard/settings/profile', (p) => p.getByRole('textbox', { name: /first name/i })],
    ]) {
      await scan(name, url, ready)
      if (name === '/dashboard/tasks') {
        // The overlays of the list: the row menu, then the delete confirmation it opens
        await page.locator('[data-cy^="tasks-menu-"]').first().click()
        await page.locator('[role="menu"]').waitFor()
        // aria-hidden-focus is off here: a Radix menu hides the page behind it with aria-hidden but leaves it
        // focusable, while its focus scope keeps Tab inside the menu (checked by the keyboard pass), so axe's
        // finding does not describe what a keyboard or screen reader user can reach.
        await scanPage(`${name} (row menu open)`, { disableRules: ['aria-hidden-focus'] })
        await page.locator('[data-cy^="tasks-action-delete-"]').first().click()
        await page.locator('[role="alertdialog"], [role="dialog"]').first().waitFor()
        await scanPage(`${name} (delete dialog open)`)
      }
    }
  } catch (error) {
    console.error(`axe-scan: ${error.message}${serverLog ? `\n--- server log ---\n${serverLog.slice(-3000)}` : ''}`)
    process.exitCode = 2
    return
  } finally {
    await browser?.close()
    serverProc?.kill()
    resend?.server.close()
  }

  const blockers = blocking(rows, failOn)
  const report = { axeVersion, failOn, counts: countByImpact(rows), scanned, violations: rows }
  if (values.json) writeFileSync(values.json, JSON.stringify(report, null, 2) + '\n')
  for (const r of rows) console.log(`${r.impact.padEnd(8)} ${(r.wcag ? '' : 'bp:') + r.rule.padEnd(28)} ${r.page.padEnd(30)} ${r.target}`)
  console.log(`counts: ${JSON.stringify(report.counts)}`)
  if (blockers.length) {
    console.error(`axe-scan: ${blockers.length} violation node(s) with impact ${failOn.join(' or ')}`)
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Anything that escapes main() is an environment error, not a finding: exit 2, never Node's default 1
  await main().catch((error) => {
    console.error(`axe-scan: ${error.message}`)
    process.exitCode = 2
  })
}
