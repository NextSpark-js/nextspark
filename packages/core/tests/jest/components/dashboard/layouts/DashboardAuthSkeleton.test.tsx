/**
 * @jest-environment jsdom
 *
 * Dashboard auth-gate skeleton (#91): the loading state is a structural shell
 * (sidebar rail, topbar, content placeholders) announced as busy, not a bare
 * spinner on a blank screen.
 */
import { describe, test, expect } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { DashboardAuthSkeleton } from '@/core/components/dashboard/layouts/DashboardAuthSkeleton'

describe('DashboardAuthSkeleton (#91)', () => {
  test('renders an accessible busy shell with sidebar, topbar and content placeholders', () => {
    const { container } = render(<DashboardAuthSkeleton />)

    const shell = screen.getByRole('status')
    expect(shell).toHaveAttribute('data-cy', 'dashboard-loading-skeleton')
    expect(shell).toHaveAttribute('aria-busy', 'true')

    // Sidebar rail only from md: up (no phantom sidebar on mobile)
    const sidebar = container.querySelector('.md\\:w-64')
    expect(sidebar).not.toBeNull()
    expect(sidebar).toHaveClass('hidden', 'md:flex')

    // Several skeleton blocks, all theme-token based (bg-muted)
    const blocks = container.querySelectorAll('.bg-muted')
    expect(blocks.length).toBeGreaterThanOrEqual(10)
  })
})
