/**
 * #417: the wizard treats a locale the same whether the template keeps it as a directory (starter: messages/es/) or
 * as flat files (crm, blog, productivity: messages/es.json and entities/<name>/messages/es.json). With only `en`
 * selected no `es` file stays anywhere; with `es` selected every catalog has one.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { processI18n } from '../src/wizard/generators/messages-generator.js'
import type { WizardConfig } from '../src/wizard/types.js'

const PROJECTS = path.resolve(import.meta.dirname, '../../core/templates/projects')

function listLocale(root: string, locale: string): string[] {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.name === `${locale}.json` || (entry.isDirectory() && entry.name === locale && path.basename(dir) === 'messages')) found.push(path.relative(root, full))
      else if (entry.isDirectory()) walk(full)
    }
  }
  for (const sub of ['messages', 'entities']) if (fs.existsSync(path.join(root, sub))) walk(path.join(root, sub))
  return found
}

async function run(template: string, supportedLocales: string[]): Promise<string> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `wizard-i18n-${template}-`))
  for (const sub of ['messages', 'entities']) {
    const from = path.join(PROJECTS, template, sub)
    if (fs.existsSync(from)) {
      fs.cpSync(from, path.join(root, sub), { recursive: true, filter: src => !src.includes('node_modules') })
    }
  }
  const cwd = process.cwd()
  process.chdir(root)
  try {
    await processI18n({ supportedLocales, defaultLocale: 'en' } as unknown as WizardConfig)
  } finally {
    process.chdir(cwd)
  }
  return root
}

for (const template of ['starter', 'blog', 'crm', 'productivity']) {
  test(`${template}: selecting only en leaves no es catalog anywhere`, async () => {
    const root = await run(template, ['en'])
    try {
      assert.deepEqual(listLocale(root, 'es'), [])
      assert.ok(listLocale(root, 'en').length > 0)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test(`${template}: selecting en and es leaves es wherever en is`, async () => {
    const root = await run(template, ['en', 'es'])
    try {
      const strip = (files: string[], locale: string) => files.map(f => f.replace(new RegExp(`${locale}(\\.json)?$`), '')).sort()
      assert.deepEqual(strip(listLocale(root, 'es'), 'es'), strip(listLocale(root, 'en'), 'en'))
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
}
