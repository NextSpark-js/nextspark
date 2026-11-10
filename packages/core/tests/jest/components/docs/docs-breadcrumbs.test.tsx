/**
 * @jest-environment jsdom
 */

/** #405: the docs breadcrumb is a sync component whose accessible name comes from the page (`label`), English by default. */
import { describe, test, expect } from '@jest/globals'
import { render } from '@testing-library/react'
import { DocsBreadcrumbs } from '@/core/components/docs/docs-breadcrumbs'

const items = [{ label: 'Home', href: '/docs' }, { label: 'Page' }]

describe('DocsBreadcrumbs', () => {
  test('names the nav with the label it is given', () => {
    const { container } = render(<DocsBreadcrumbs items={items} label="Migas de pan" />)
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Migas de pan')
  })
})
