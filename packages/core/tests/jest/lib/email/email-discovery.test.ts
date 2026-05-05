/**
 * Tests for the email discovery + registry generator.
 *
 * These shell out to a small Node entry point that imports the .mjs modules
 * directly — Jest with the ts-jest CJS transform can't dynamic-import .mjs
 * so we run the discovery+generator in a subprocess and assert on its
 * stdout. This validates the actual production code path end-to-end against
 * fixture directories (not a re-implementation).
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execFileSync } from 'child_process'

const REPO_ROOT = join(__dirname, '../../../../../..')
const RUNNER = join(__dirname, 'fixtures', 'discover-emails-runner.mjs')

function runDiscovery(opts: {
  fixtureRoot: string
  activeTheme: string | null
}): {
  emails: Array<{ slug: string; source: 'core' | 'theme'; importPath: string; importName: string }>
  generated: string
} {
  const outputPath = join(opts.fixtureRoot, 'discovery-result.json')
  execFileSync(
    'node',
    [RUNNER, opts.fixtureRoot, opts.activeTheme ?? '', outputPath],
    {
      cwd: REPO_ROOT,
      // Discard runner stdout/stderr — the result is in outputPath.
      stdio: ['ignore', 'ignore', 'ignore'],
    },
  )
  return JSON.parse(readFileSync(outputPath, 'utf8'))
}

describe('email discovery + registry generation', () => {
  let tmpRoot: string
  let coreSrcEmails: string
  let themeEmails: string

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'nextspark-email-test-'))
    coreSrcEmails = join(tmpRoot, 'core', 'src', 'emails')
    themeEmails = join(tmpRoot, 'themes', 'demo', 'emails')
    mkdirSync(coreSrcEmails, { recursive: true })
    mkdirSync(themeEmails, { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('discovers core defaults when no theme override exists', () => {
    writeFileSync(join(coreSrcEmails, 'verify-email.ts'), 'export default () => ({})')
    writeFileSync(join(coreSrcEmails, 'reset-password.ts'), 'export default () => ({})')
    const { emails } = runDiscovery({ fixtureRoot: tmpRoot, activeTheme: 'demo' })
    expect(emails).toHaveLength(2)
    expect(emails.map(e => e.slug).sort()).toEqual(['reset-password', 'verify-email'])
    expect(emails.every(e => e.source === 'core')).toBe(true)
  })

  it('theme file overrides core at the same slug', () => {
    writeFileSync(join(coreSrcEmails, 'verify-email.ts'), 'export default () => ({})')
    writeFileSync(join(themeEmails, 'verify-email.ts'), 'export default () => ({})')
    const { emails } = runDiscovery({ fixtureRoot: tmpRoot, activeTheme: 'demo' })
    expect(emails).toHaveLength(1)
    expect(emails[0].slug).toBe('verify-email')
    expect(emails[0].source).toBe('theme')
    expect(emails[0].importPath).toBe('@/contents/themes/demo/emails/verify-email')
  })

  it('theme can add new slugs that core does not know about', () => {
    writeFileSync(join(coreSrcEmails, 'verify-email.ts'), 'export default () => ({})')
    writeFileSync(join(themeEmails, 'welcome.ts'), 'export default () => ({})')
    writeFileSync(join(themeEmails, 'purchase-confirmation.ts'), 'export default () => ({})')
    const { emails } = runDiscovery({ fixtureRoot: tmpRoot, activeTheme: 'demo' })
    expect(emails.map(e => e.slug).sort()).toEqual([
      'purchase-confirmation',
      'verify-email',
      'welcome',
    ])
    const purchase = emails.find(e => e.slug === 'purchase-confirmation')!
    expect(purchase.source).toBe('theme')
    const verify = emails.find(e => e.slug === 'verify-email')!
    expect(verify.source).toBe('core')
  })

  it('skips index, _README, .test, and .d.ts files', () => {
    writeFileSync(join(coreSrcEmails, 'index.ts'), 'export {}')
    writeFileSync(join(coreSrcEmails, '_README.ts'), 'export {}')
    writeFileSync(join(coreSrcEmails, 'verify-email.test.ts'), 'export {}')
    writeFileSync(join(coreSrcEmails, 'verify-email.d.ts'), 'export {}')
    writeFileSync(join(coreSrcEmails, 'verify-email.ts'), 'export default () => ({})')
    const { emails } = runDiscovery({ fixtureRoot: tmpRoot, activeTheme: 'demo' })
    expect(emails).toHaveLength(1)
    expect(emails[0].slug).toBe('verify-email')
  })

  it('handles missing theme directory gracefully', () => {
    writeFileSync(join(coreSrcEmails, 'verify-email.ts'), 'export default () => ({})')
    rmSync(themeEmails, { recursive: true, force: true })
    const { emails } = runDiscovery({ fixtureRoot: tmpRoot, activeTheme: 'demo' })
    expect(emails).toHaveLength(1)
    expect(emails[0].source).toBe('core')
  })

  it('generator emits `as const` literal without Record annotation', () => {
    writeFileSync(join(coreSrcEmails, 'verify-email.ts'), 'export default () => ({})')
    writeFileSync(join(themeEmails, 'welcome.ts'), 'export default () => ({})')
    const { generated } = runDiscovery({ fixtureRoot: tmpRoot, activeTheme: 'demo' })

    // Critical: no Record<…> annotation (would erase per-slug type inference)
    expect(generated).not.toMatch(/EMAIL_REGISTRY:\s*Record</)

    // Must use `as const` for inference
    expect(generated).toContain('} as const')
    expect(generated).toContain('EmailSlug = keyof typeof EMAIL_REGISTRY')

    // Verify import paths look right per source
    expect(generated).toContain("'@/core/emails/verify-email'")
    expect(generated).toContain("'@/contents/themes/demo/emails/welcome'")

    // Metadata reflects override status
    expect(generated).toContain("'verify-email': { source: 'core'")
    expect(generated).toContain("'welcome': { source: 'theme'")
  })

  it('still discovers core when activeTheme is null', () => {
    writeFileSync(join(coreSrcEmails, 'verify-email.ts'), 'export default () => ({})')
    const { emails } = runDiscovery({ fixtureRoot: tmpRoot, activeTheme: null })
    expect(emails).toHaveLength(1)
    expect(emails[0].source).toBe('core')
  })
})
