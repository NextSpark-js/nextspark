import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { getTemplatesDir } from '../src/wizard/generators/templates-dir.js'
import { copyStarterTheme } from '../src/wizard/generators/theme-renamer.js'
import { copyContentFeatures } from '../src/wizard/generators/content-features-generator.js'
import type { WizardConfig } from '../src/wizard/types.js'

const config = { projectSlug: 'acme', contentFeatures: { pages: true, blog: true } } as WizardConfig

/**
 * A project with @nextsparkjs/core installed at its root, whose templates carry
 * markers. From this repo the CLI also finds packages/core/templates next to
 * its own sources, which has no markers, so a copy taken from anywhere but the
 * project's install shows up as a missing marker.
 */
function projectWithInstalledCore(): { root: string; web: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-templates-'))
  const templates = path.join(root, 'node_modules/@nextsparkjs/core/templates')
  for (const [file, text] of [
    ['projects/starter/marker.txt', 'starter'],
    ['features/pages/entities/pages/marker.txt', 'pages'],
    ['features/blog/blocks/post-content/marker.txt', 'post-content'],
  ]) {
    fs.mkdirSync(path.dirname(path.join(templates, file)), { recursive: true })
    fs.writeFileSync(path.join(templates, file), text)
  }
  const web = path.join(root, 'web')
  fs.mkdirSync(web)
  return { root, web }
}

async function generateThemeFrom(cwd: string, copy: () => Promise<void>): Promise<void> {
  const previous = process.cwd()
  process.chdir(cwd)
  try {
    await copy()
  } finally {
    process.chdir(previous)
  }
}

function copiedMarkers(projectDir: string): string[] {
  return ['marker.txt', 'entities/pages/marker.txt', 'blocks/post-content/marker.txt'].map(file =>
    fs.existsSync(path.join(projectDir, file)) ? fs.readFileSync(path.join(projectDir, file), 'utf8') : `missing ${file}`
  )
}

test("a web + mobile project's web/ gets the theme and content features from the root install", async () => {
  const { root, web } = projectWithInstalledCore()
  try {
    // generateProject resolves the templates at the root, then moves into web/.
    const templatesDir = getTemplatesDir(root)
    await generateThemeFrom(web, async () => {
      await copyStarterTheme(config, templatesDir)
      await copyContentFeatures(config, templatesDir)
    })

    assert.deepEqual(copiedMarkers(web), ['starter', 'pages', 'post-content'])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('a web-only project, generated from its root, still finds its install by default', async () => {
  const { root } = projectWithInstalledCore()
  try {
    await generateThemeFrom(root, async () => {
      await copyStarterTheme(config)
      await copyContentFeatures(config)
    })

    assert.deepEqual(copiedMarkers(root), ['starter', 'pages', 'post-content'])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
