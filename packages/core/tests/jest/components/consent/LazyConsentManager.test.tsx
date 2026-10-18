import { act, render, screen } from '@testing-library/react'
import { LazyConsentManager } from '@nextsparkjs/core/components/consent/LazyConsentManager'
import { CONSENT_OPEN_EVENT } from '@nextsparkjs/core/lib/consent/cookie'

jest.mock('@nextsparkjs/core/components/consent/ConsentManager', () => ({
  ConsentManager: ({ nonce, openOnMount }: { nonce?: string; openOnMount?: boolean }) => (
    <aside data-testid="manager" data-nonce={nonce ?? ''} data-open={String(Boolean(openOnMount))} />
  ),
}))

describe('LazyConsentManager', () => {
  it('renders nothing until the manager chunk has loaded, then the manager', async () => {
    const { container } = render(<LazyConsentManager nonce="abc" />)
    expect(container).toBeEmptyDOMElement()
    const manager = await screen.findByTestId('manager')
    expect(manager).toHaveAttribute('data-nonce', 'abc')
    expect(manager).toHaveAttribute('data-open', 'false')
  })

  it('keeps a "Cookie settings" click that comes before the chunk has loaded: the manager opens on mount', async () => {
    render(<LazyConsentManager />)
    act(() => void window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT)))
    expect(screen.queryByTestId('manager')).toBeNull()
    expect(await screen.findByTestId('manager')).toHaveAttribute('data-open', 'true')
  })
})
