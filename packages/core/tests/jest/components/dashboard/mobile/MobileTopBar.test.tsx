/**
 * @jest-environment jsdom
 *
 * MobileTopBar (#178): the profile link forwards `prefetch` so apps can stop the
 * automatic RSC prefetch that this always-mounted bar fires on every dashboard page.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { render } from '@testing-library/react'
import { MobileTopBar } from '@/core/components/dashboard/mobile/MobileTopBar'

const mockLinkProps: Record<string, unknown>[] = []
const mockTranslate = jest.fn((key: string) => key)
const mockUser: Record<string, string | undefined> = { id: 'u1', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' }

jest.mock('next/link', () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode; href: string } & Record<string, unknown>) => {
    mockLinkProps.push(props)
    return <a href={props.href}>{props.children as React.ReactNode}</a>
  },
}))

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => <img alt="" {...props} />,
}))

jest.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}))

jest.mock('next-intl', () => ({
  useTranslations: () => mockTranslate,
}))

jest.mock('@/core/lib/config', () => ({
  isTopbarFeatureEnabled: () => false,
}))

describe('MobileTopBar profile link prefetch (#178)', () => {
  beforeEach(() => {
    mockLinkProps.length = 0
    mockTranslate.mockClear()
    Object.assign(mockUser, { id: 'u1', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', name: undefined })
  })

  test('leaves prefetch to Next.js when the prop is not passed', () => {
    render(<MobileTopBar />)

    expect(mockLinkProps).toHaveLength(1)
    expect(mockLinkProps[0].href).toBe('/dashboard/settings/profile')
    expect(mockLinkProps[0].prefetch).toBeUndefined()
  })

  test('uses the user id rather than an untranslated fallback when no display data is available', () => {
    Object.assign(mockUser, { email: undefined, firstName: undefined, lastName: undefined, name: undefined })

    render(<MobileTopBar />)

    expect(mockTranslate).toHaveBeenCalledWith('common.mobileNav.greeting', { name: 'u1' })
  })

  test('forwards prefetch={false} to the profile link', () => {
    render(<MobileTopBar prefetch={false} />)

    expect(mockLinkProps).toHaveLength(1)
    expect(mockLinkProps[0].prefetch).toBe(false)
  })
})
