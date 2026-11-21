/**
 * @jest-environment jsdom
 *
 * #539: a block without a thumbnail gets a compact card, not a 130px "No preview" placeholder.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'

// the screens keep their state in the URL (#519)
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }), usePathname: () => '/area', useSearchParams: () => new URLSearchParams() }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/hooks/useLocalizedText', () => ({ useLocalizedText: () => (v: string) => v }))
jest.mock('@nextsparkjs/registries/testing-registry', () => ({ TAGS_REGISTRY: { blocks: {} } }))
jest.mock('@nextsparkjs/registries/block-registry.client', () => {
  const block = (slug: string, thumbnail?: { src: string }) => ({
    slug, name: slug, description: 'd', category: 'hero', scope: ['pages'], fieldDefinitions: [], examples: [], thumbnail,
  })
  return { BLOCK_REGISTRY: { plain: block('plain'), pretty: block('pretty', { src: '/t.png' }) } }
})

import { BlocksViewer } from '@/core/components/devtools/BlocksViewer'

describe('BlocksViewer cards', () => {
  test('only a block with a thumbnail gets the thumbnail band', () => {
    render(<BlocksViewer />)
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.queryByText('noPreview')).toBeNull()
    expect(screen.getAllByText(/^(plain|pretty)$/)).toHaveLength(2)
  })
})
