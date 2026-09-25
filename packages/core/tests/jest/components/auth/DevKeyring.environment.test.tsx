/** @jest-environment jsdom */
import { afterEach, describe, expect, test } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { DevKeyring } from '@/core/components/auth/DevKeyring'

const originalNodeEnv = process.env.NODE_ENV
const config = {
  enabled: true,
  users: [{ id: 'test-user', email: 'test@example.test', name: 'Test User', password: 'test-password' }],
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
})

describe('DevKeyring environment boundary', () => {
  test('renders development quick-login controls outside production', () => {
    process.env.NODE_ENV = 'development'
    render(<DevKeyring config={config} />)

    expect(screen.getByText('Dev Keyring')).toBeInTheDocument()
  })

  test('does not render production quick-login controls even when given config', () => {
    process.env.NODE_ENV = 'production'
    render(<DevKeyring config={config} />)

    expect(screen.queryByText('Dev Keyring')).not.toBeInTheDocument()
  })
})

test('LoginForm keeps DevKeyring requires behind the production-dead branch', () => {
  const source = readFileSync(resolve(__dirname, '../../../../src/components/auth/forms/LoginForm.tsx'), 'utf8')

  expect(source).not.toContain("import { DevKeyring } from '../DevKeyring'")
  expect(source).not.toContain("import { DEV_KEYRING_CONFIG } from '@nextsparkjs/registries/dev-keyring.client'")
  expect(source).toMatch(/process\.env\.NODE_ENV !== 'production'\n    \? require\('@nextsparkjs\/registries\/dev-keyring\.client'\)/)
  expect(source).toMatch(/process\.env\.NODE_ENV !== 'production'\n  \? require\('\.\.\/DevKeyring'\)/)
})
