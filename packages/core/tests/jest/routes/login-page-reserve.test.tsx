/**
 * /login holds the height of the form it will show while the sign-in methods load (#557). The page decides it on the
 * server from static config, in a box (`.lr`, whose rule is in styles/utilities.css) that has the height only while
 * the loading card is there.
 */
import React from 'react'
import fs from 'fs'
import path from 'path'
import { cleanup, render } from '@testing-library/react'

const authConfig: { methods: string[]; registration: { mode: string } } = { methods: ['email-otp', 'google'], registration: { mode: 'open' } }
const devConfig: { devKeyring?: { users: unknown[] } } = {}

jest.mock('@nextsparkjs/core/components/auth/forms/LoginForm', () => ({ LoginForm: () => <div data-testid="form" /> }))
jest.mock('@nextsparkjs/core/lib/config/public-config-client', () => ({ PUBLIC_AUTH_CONFIG: authConfig }))
jest.mock('@nextsparkjs/core/lib/config/config-sync', () => ({ DEV_CONFIG: devConfig }))
jest.mock('@nextsparkjs/core/routes/_internal/auth-metadata', () => ({ authPageMetadata: jest.fn() }))

import LoginPage from '../../../src/routes/(auth)/login/page'

const box = () => {
  cleanup()
  const { getByTestId } = render(<LoginPage />)
  return getByTestId('form').parentElement as HTMLElement
}
const vars = (el: HTMLElement) => [el.style.getPropertyValue('--r'), el.style.getPropertyValue('--r-sm')]

beforeEach(() => {
  delete process.env.NEXTSPARK_DEMO_MODE
  authConfig.methods = ['email-otp', 'google']
  authConfig.registration.mode = 'open'
  delete devConfig.devKeyring
})

test('the rule that gives the box its height only holds while the loading card is there, and falls back to the mobile height', () => {
  const css = fs.readFileSync(path.join(__dirname, '../../../styles/utilities.css'), 'utf8')
  expect(css).toContain('.lr:has([data-cy=login-readiness-loading]){min-height:var(--r)}')
  expect(css).toContain('min-height:var(--r-sm,var(--r))')
  const el = box()
  expect(el.className).toBe('lr')
  expect(vars(el)).toEqual(['230px', ''])
})

test('a demo reserves the 670 px the password form with 2 accounts has at 360 px, and 604 px from 640 px', () => {
  process.env.NEXTSPARK_DEMO_MODE = 'true'
  devConfig.devKeyring = { users: [{}, {}] }
  expect(vars(box())).toEqual(['670px', '604px'])
})

test('a demo with 4 accounts reserves more', () => {
  process.env.NEXTSPARK_DEMO_MODE = 'true'
  devConfig.devKeyring = { users: [{}, {}, {}, {}] }
  expect(vars(box())).toEqual(['798px', '752px'])
})

test.each([
  [['email-otp'], ['272px', '256px']],
  [['email-password'], ['426px', '']],
  [['google', 'email-otp'], ['230px', '']],
  [['email-otp', 'email-password'], ['376px', '360px']],
  // the starter's commented examples
  [['email-password', 'google'], ['274px', '']],
  [['email-otp', 'email-password', 'google'], ['274px', '']],
])('%j reserves %j', (methods, expected) => {
  authConfig.methods = methods
  expect(vars(box())).toEqual(expected)
})

test.each([
  [['email-password'], ['382px', '']],
  [['email-otp', 'email-password'], ['332px', '316px']],
  [['email-password', 'google'], ['230px', '']],
])('%j without the sign up link (invitation-only) reserves %j', (methods, expected) => {
  authConfig.methods = methods
  authConfig.registration.mode = 'invitation-only'
  expect(vars(box())).toEqual(expected)
})

test('the sign up link is also there with domain-open, and a form with no password has none to subtract', () => {
  authConfig.methods = ['email-password']
  authConfig.registration.mode = 'domain-open'
  expect(vars(box())).toEqual(['426px', ''])
  authConfig.methods = ['email-otp']
  authConfig.registration.mode = 'invitation-only'
  expect(vars(box())).toEqual(['272px', '256px'])
})

test('a combination that was not measured, and domain-restricted without a demo, are left as they were', () => {
  authConfig.methods = ['magic-link', 'github']
  expect(box().className).toBeFalsy()
  authConfig.methods = ['email-password']
  authConfig.registration.mode = 'domain-restricted'
  expect(box().className).toBeFalsy()
})
