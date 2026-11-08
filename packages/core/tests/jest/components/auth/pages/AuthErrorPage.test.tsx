/**
 * @jest-environment jsdom
 *
 * What the error page says for the failures of a sign-in link.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'

let mockError = ''
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(`error=${mockError}`) }))
jest.mock('next-intl', () => ({ useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}` }))

import { AuthErrorPage } from '@/core/components/auth/pages/AuthErrorPage'

describe('AuthErrorPage', () => {
  test.each([
    ['INVALID_TOKEN', 'auth.error.magicLink.title', 'auth.error.magicLink.description'],
    ['SIGNUP_RESTRICTED', 'auth.error.unable_to_create.title', 'auth.registrationErrors.signupRestricted'],
    ['ANYTHING_ELSE', 'auth.error.generic.title', 'auth.error.generic.description'],
  ])('%s', (code, title, description) => {
    mockError = code
    render(<AuthErrorPage />)
    expect(screen.getByText(title)).toBeInTheDocument()
    expect(screen.getByText(description)).toBeInTheDocument()
  })
})
