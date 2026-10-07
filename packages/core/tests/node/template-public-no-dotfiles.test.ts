/**
 * Next answers a request for a dotfile under public/ (`/brand/.gitkeep`, `/uploads/.gitignore`) with a 500. The
 * scaffold copies packages/core/templates/public and a project template's public/ as they are, so neither may
 * carry a dotfile; the ignore rule for development uploads lives in the generated .gitignore instead.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const TEMPLATES = path.join(REPO_ROOT, 'packages/core/templates')

function dotfiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.name.startsWith('.')) out.push(path.relative(REPO_ROOT, full))
    else if (entry.isDirectory()) dotfiles(full, out)
  }
  return out
}

const publicDirs = [
  path.join(TEMPLATES, 'public'),
  ...fs.readdirSync(path.join(TEMPLATES, 'projects')).map(name => path.join(TEMPLATES, 'projects', name, 'public')),
]

test('no template public/ folder carries a dotfile', () => {
  assert.deepEqual(publicDirs.flatMap(dir => dotfiles(dir)), [])
})

test('the generated .gitignore ignores development uploads', async () => {
  const template = fs.readFileSync(path.join(TEMPLATES, '.gitignore'), 'utf8')
  assert.ok(template.split('\n').includes('public/uploads/temp/'))
  const { GITIGNORE_CONTENT } = await import('../../../cli/src/wizard/generators/git-init.js')
  assert.ok(GITIGNORE_CONTENT.split('\n').includes('public/uploads/temp/'))
})
