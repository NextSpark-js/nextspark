/**
 * The example payloads of the API Explorer carry an evident placeholder, never a password a template's dev keyring uses
 * (the dev-credentials probe of a generated project would read it as one).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

test('the auth presets use no real-looking password', () => {
  const source = readFileSync(path.join(__dirname, '../../../src/routes/api/v1/auth/presets.ts'), 'utf8')
  expect(source).not.toContain('Test1234')
  expect(source).toContain("password: 'your-password-here'")
})
