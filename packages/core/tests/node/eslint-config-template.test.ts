/**
 * `nextspark init` gives a project packages/core/templates/eslint.config.mjs and a `lint` script
 * that runs `eslint .`. That walks everything NextSpark writes into the project -- app/ from core,
 * every theme and plugin under contents/, their tests and fixtures -- so the project must lint
 * clean out of the box, while the zod rule keeps reaching the block schemas under
 * contents/themes/. The same file reaches Next 15 projects, whose eslint-config-next publishes
 * eslintrc presets instead of flat ones.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const TEMPLATES = path.join(REPO, 'packages/core/templates')
const requireFromRepo = createRequire(path.join(REPO, 'package.json'))
const { ESLint } = requireFromRepo('eslint') as typeof import('eslint')

const ZOD_MESSAGE = /Use `import \* as z from 'zod'`/

type LintMessage = { file: string; line: number; ruleId: string | null; severity: number; message: string }

function tempProject(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-eslint-config-')))
  fs.copyFileSync(path.join(TEMPLATES, 'eslint.config.mjs'), path.join(root, 'eslint.config.mjs'))
  return root
}

/** Makes `name`, as installed at the repo root, resolvable from the project. */
function linkFromRepo(root: string, name: string): void {
  const target = path.join(root, 'node_modules', name)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.symlinkSync(fs.realpathSync(path.join(REPO, 'node_modules', name)), target, 'dir')
}

function copyTree(from: string, to: string): void {
  fs.cpSync(from, to, {
    recursive: true,
    filter: (source) => !source.split(path.sep).some((segment) => segment === 'node_modules' || segment === '.next'),
  })
}

function write(root: string, file: string, contents: string): void {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), contents)
}

async function lint(root: string, patterns: string[]): Promise<LintMessage[]> {
  const results = await new ESLint({ cwd: root }).lintFiles(patterns)
  return results.flatMap((result) =>
    result.messages.map((message) => ({
      file: path.relative(root, result.filePath),
      line: message.line,
      ruleId: message.ruleId,
      severity: message.severity,
      message: message.message,
    })),
  )
}

const format = (messages: LintMessage[]) =>
  messages.slice(0, 20).map((m) => `${m.file}:${m.line} ${m.ruleId ?? 'fatal'} ${m.message.split('\n')[0]}`).join('\n')

/** A schema importing zod's named `z`, and a module typed with `any`, under `dir`. */
function writeProbes(root: string, dir: string): void {
  write(root, `${dir}/blocks/probe/schema.ts`, "import { z } from 'zod'\n\nexport const probeSchema: z.ZodString = z.string()\n")
  write(root, `${dir}/lib/loose.ts`, 'export const loose: any = 1\n')
}

test('a project holding everything NextSpark writes lints clean on Next 16', async () => {
  const root = tempProject()
  try {
    linkFromRepo(root, 'eslint')
    linkFromRepo(root, 'eslint-config-next')

    copyTree(path.join(REPO, 'apps/dev/app'), path.join(root, 'app'))
    for (const theme of fs.readdirSync(path.join(REPO, 'themes'))) {
      copyTree(path.join(REPO, 'themes', theme), path.join(root, 'contents/themes', theme))
    }
    copyTree(path.join(TEMPLATES, 'contents/themes/starter'), path.join(root, 'contents/themes/my-app'))
    for (const plugin of fs.readdirSync(path.join(REPO, 'plugins'))) {
      copyTree(path.join(REPO, 'plugins', plugin), path.join(root, 'contents/plugins', plugin))
    }
    for (const entry of ['proxy.ts', 'i18n.ts', 'instrumentation.ts', 'next.config.mjs', 'postcss.config.mjs', 'public', 'scripts']) {
      copyTree(path.join(TEMPLATES, entry), path.join(root, entry))
    }
    write(root, 'next-env.d.ts', '/// <reference types="next" />\n/// <reference path="./.next/types/routes.d.ts" />\n')

    const messages = await lint(root, ['.'])
    assert.equal(messages.length, 0, `expected no problems, got ${messages.length}:\n${format(messages)}`)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('on Next 16 the zod rule reaches a theme schema, and Next\'s presets the code outside app/ and contents/', async () => {
  const root = tempProject()
  try {
    linkFromRepo(root, 'eslint')
    linkFromRepo(root, 'eslint-config-next')
    writeProbes(root, 'contents/themes/my-app')
    writeProbes(root, 'src')
    write(root, 'app/page.tsx', 'export default function Page() {\n  return <main>ok</main>\n}\n')

    const messages = await lint(root, ['.'])
    const summary = messages.map((m) => `${m.file} ${m.ruleId}`).sort()

    assert.deepEqual(summary, [
      'contents/themes/my-app/blocks/probe/schema.ts no-restricted-syntax',
      'src/blocks/probe/schema.ts no-restricted-syntax',
      'src/lib/loose.ts @typescript-eslint/no-explicit-any',
    ], format(messages))
    assert.ok(messages.filter((m) => m.ruleId === 'no-restricted-syntax').every((m) => ZOD_MESSAGE.test(m.message)))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

/**
 * eslint-config-next 15 as published: `main` and no `exports`, and eslintrc presets on
 * core-web-vitals.js and typescript.js, TypeScript parsed through an override.
 */
function installEslintConfigNext15(root: string): void {
  const dir = path.join(root, 'node_modules/eslint-config-next')
  write(dir, 'package.json', JSON.stringify({ name: 'eslint-config-next', version: '15.5.25', main: 'index.js' }))
  write(dir, 'index.js', `module.exports = {
  parserOptions: { sourceType: 'module', ecmaFeatures: { jsx: true } },
  overrides: [{ files: ['**/*.ts?(x)'], parser: '@typescript-eslint/parser', parserOptions: { sourceType: 'module' } }],
}
`)
  write(dir, 'core-web-vitals.js', "module.exports = { extends: [require.resolve('.')] }\n")
  write(dir, 'typescript.js', "module.exports = { extends: ['plugin:@typescript-eslint/recommended'] }\n")
  linkFromRepo(root, '@typescript-eslint/parser')
  linkFromRepo(root, '@typescript-eslint/eslint-plugin')
}

test('a Next 15 project parses TypeScript and JSX, with Next\'s presets and the zod rule', async () => {
  const root = tempProject()
  try {
    linkFromRepo(root, 'eslint')
    installEslintConfigNext15(root)
    writeProbes(root, 'contents/themes/my-app')
    writeProbes(root, 'src')
    write(root, 'app/page.tsx', 'export default function Page(): JSX.Element {\n  return <main>ok</main>\n}\n')
    write(root, 'src/components/card.tsx', 'export const Card = ({ title }: { title: string }) => <h2>{title}</h2>\n')

    const messages = await lint(root, ['.'])
    const summary = messages.map((m) => `${m.file} ${m.ruleId}`).sort()

    assert.deepEqual(summary, [
      'contents/themes/my-app/blocks/probe/schema.ts no-restricted-syntax',
      'src/blocks/probe/schema.ts no-restricted-syntax',
      'src/lib/loose.ts @typescript-eslint/no-explicit-any',
    ], format(messages))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
