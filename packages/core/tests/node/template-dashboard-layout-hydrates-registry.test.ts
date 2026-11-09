/**
 * #417: a project template whose templates/dashboard/(main)/layout.tsx replaces core's DashboardShell has to hydrate
 * the client entity registry itself (EntityRegistryHydrator), or the entity detail and edit pages answer
 * `Entity "<slug>" not found in the registry`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projects = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../templates/projects')

test('every template that replaces the main dashboard layout hydrates the entity registry', () => {
  const layouts = fs.readdirSync(projects)
    .map(name => path.join(projects, name, 'templates/dashboard/(main)/layout.tsx'))
    .filter(file => fs.existsSync(file))
  assert.ok(layouts.length >= 2, 'the crm and productivity templates replace the layout')
  for (const file of layouts) {
    const source = fs.readFileSync(file, 'utf8')
    assert.match(source, /EntityRegistryHydrator/, `${path.relative(projects, file)} must hydrate the entity registry`)
    assert.doesNotMatch(source, /^'use client'/m, `${path.relative(projects, file)} is a server layout that reads the registry`)
  }
})
