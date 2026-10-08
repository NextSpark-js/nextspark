/**
 * Landmarks: each area of the app owns one <main> (the root layout renders none), and the auth layout is its own
 * main. A page with two mains, or with none, fails axe's landmark rules and gives screen reader users no "skip to
 * main" target.
 */
import { describe, it, expect, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'

jest.mock('@nextsparkjs/core/components/auth/layouts/AuthWrapper', () => ({
  AuthWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@nextsparkjs/core/lib/config/public-config-client', () => ({ APP_NAME: 'App', APP_DESCRIPTION: 'Desc' }))

import { DefaultAuthLayout } from '@/core/routes/_internal/default-auth-layout'

describe('landmarks', () => {
  it('the default auth layout is the only main of its pages', () => {
    render(
      <DefaultAuthLayout>
        <form aria-label="login" />
      </DefaultAuthLayout>
    )
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('main').querySelector('form')).not.toBeNull()
  })
})
