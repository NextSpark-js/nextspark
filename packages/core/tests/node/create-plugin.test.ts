/**
 * scripts/create-plugin.mjs scaffolds a plugin from templates/plugins/starter. The generated plugin must be
 * self-consistent: every relative import resolves to a generated file, and the names built from the plugin
 * name are PascalCase (types, hook, widget) except the exported `<name>PluginConfig`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CORE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SCRIPT = path.join(CORE_DIR, 'scripts/create-plugin.mjs')

function generate(name: string): { dir: string; files: Map<string, string> } {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'create-plugin-'))
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'scratch', private: true, dependencies: { next: '~16.3.8' } }))
  fs.writeFileSync(path.join(project, 'nextspark.config.ts'), 'export default {}\n')
  execFileSync('node', [SCRIPT, name], { cwd: project, stdio: 'pipe' })
  const dir = path.join(project, 'plugins', name)
  const files = new Map<string, string>()
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else files.set(path.relative(dir, full), fs.readFileSync(full, 'utf8'))
    }
  }
  walk(dir)
  return { dir, files }
}

for (const [name, pascal, camel] of [['my-demo', 'MyDemo', 'myDemo'], ['analytics', 'Analytics', 'analytics']]) {
  test(`create-plugin ${name}: relative imports resolve and names are PascalCase`, () => {
    const { dir, files } = generate(name)
    try {
      assert.ok(files.has(`hooks/use${pascal}.ts`), `hooks/use${pascal}.ts is generated`)
      assert.ok(files.has(`components/${pascal}Widget.tsx`), `components/${pascal}Widget.tsx is generated`)

      for (const [file, source] of files) {
        assert.doesNotMatch(source, /\{\{[A-Z_]+\}\}/, `${file} has an unreplaced placeholder`)
        if (!/\.(?:ts|tsx)$/.test(file)) continue
        for (const [, specifier] of source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
          const target = path.resolve(dir, path.dirname(file), specifier)
          const found = ['.ts', '.tsx', '/index.ts', '/index.tsx'].some(ext => files.has(path.relative(dir, target + ext)))
          assert.ok(found, `${file} imports ${specifier}, which is not a generated file`)
        }
      }

      const all = [...files.values()].join('\n')
      for (const wanted of [`use${pascal}`, `Use${pascal}Return`, `${pascal}Config`, `${pascal}Result`, `${pascal}Widget`, `${camel}PluginConfig`]) {
        assert.ok(all.includes(wanted), `generated plugin has ${wanted}`)
      }
      if (camel !== pascal) {
        for (const bad of [`use${camel}`, `${camel}Config`, `${camel}Result`, `${camel}Widget`]) {
          assert.ok(!new RegExp(`\\b${bad}\\b`).test(all), `generated plugin has the camelCase name ${bad}`)
        }
      }
    } finally {
      fs.rmSync(path.dirname(path.dirname(dir)), { recursive: true, force: true })
    }
  })
}
