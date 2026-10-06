/**
 * The project's name and description reach app.config.ts for every template: the sign-in pages, the emails and the
 * page titles read `app.name` / `app.description` from there instead of a hard-coded "Boilerplate" / "Your App".
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { withAppIdentity } from '../src/wizard/generators/theme-renamer.js'

const PROJECTS = path.resolve(import.meta.dirname, '../../core/templates/projects')
const config = { projectName: 'Acme Cloud', projectDescription: 'Acme Cloud - built with NextSpark' }

for (const template of ['starter', 'blog', 'crm', 'productivity']) {
  test(`${template}: app.name and app.description become the wizard's`, () => {
    const source = fs.readFileSync(path.join(PROJECTS, template, 'config/app.config.ts'), 'utf8')
    const result = withAppIdentity(source, config)

    assert.match(result, /app: \{\s*name: "Acme Cloud",\s*description: "Acme Cloud - built with NextSpark",\s*version: /)
    assert.equal(result.match(/description: "Acme Cloud/g)?.length, 1)
  })
}

test('a name with a quote, a backslash, `$&` or a control character stays one valid string literal', () => {
  const source = "export const X = {\n  app: {\n    name: 'Starter',\n    version: '1.0.0',\n  },\n}\n"
  const projectName = "Bob's \\ $& App"
  const projectDescription = 'line one\r\nline two'
  const result = withAppIdentity(source, { projectName, projectDescription })

  const app = new Function(`${result.replace('export const X', 'const X')}; return X.app`)()
  assert.equal(app.name, projectName)
  assert.equal(app.description, projectDescription)
})

test('running it twice leaves one description', () => {
  const source = "export const X = {\n  app: {\n    name: 'Starter',\n    version: '1.0.0',\n  },\n}\n"
  const once = withAppIdentity(source, config)
  const twice = withAppIdentity(once, { projectName: 'Other', projectDescription: 'Other desc' })

  assert.equal(twice.match(/description:/g)?.length, 1)
  assert.match(twice, /name: "Other",\s*description: "Other desc",\s*version/)
})
