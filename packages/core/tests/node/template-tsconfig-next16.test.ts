/**
 * The first `next dev` or `next build` rewrites a tsconfig.json that lacks what Next 16 requires (jsx, the
 * .next/dev/types include), and so dirties a tree that was just committed. The template already carries those values.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const templates = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../templates')
// The template has comments: read it the way TypeScript does
const tsconfig = JSON.parse(fs.readFileSync(path.join(templates, 'tsconfig.json'), 'utf8').replace(/^\s*\/\/.*$/gm, ''))

test('the template tsconfig has the jsx value and the type includes Next 16 writes', () => {
  assert.equal(tsconfig.compilerOptions.jsx, 'react-jsx')
  assert.ok(tsconfig.include.includes('.next/types/**/*.ts'))
  assert.ok(tsconfig.include.includes('.next/dev/types/**/*.ts'))
})

test('the template .gitignore ignores next-env.d.ts, which Next rewrites when it switches between dev and build', () => {
  const lines = fs.readFileSync(path.join(templates, '.gitignore'), 'utf8').split('\n').map((line) => line.trim())
  assert.ok(lines.includes('next-env.d.ts'))
})

test('the template next.config.mjs turns off the agent-rules file Next 16.3 writes into AGENTS.md', () => {
  assert.match(fs.readFileSync(path.join(templates, 'next.config.mjs'), 'utf8'), /^\s*agentRules: false,/m)
})
