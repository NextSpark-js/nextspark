/**
 * Billing screens without a payment gateway (provider: 'none', #322): the pricing table still compares plans but
 * offers no checkout, and the portal button is gone even for a subscription that has an external customer.
 */
import { render } from '@testing-library/react'

const mockRegistry = {
  provider: 'none',
  plans: [
    { slug: 'free', name: 'Free', visibility: 'public', features: [], limits: {} },
    { slug: 'pro', name: 'Pro', visibility: 'public', price: { monthly: 1000 }, features: [], limits: {} },
  ],
  features: {},
  limits: {},
}
jest.mock('@nextsparkjs/registries/billing-registry', () => ({ BILLING_REGISTRY: mockRegistry }))

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }))
jest.mock('@/core/hooks/useSubscription', () => ({
  useSubscription: () => ({
    planSlug: 'free',
    isReady: true,
    subscription: { externalCustomerId: 'cus_1', externalSubscriptionId: 'sub_1' },
  }),
}))

import { PricingTable } from '@/core/components/billing/PricingTable'
import { ManageBillingButton } from '@/core/components/billing/ManageBillingButton'

afterEach(() => {
  mockRegistry.provider = 'none'
})

describe('provider: none', () => {
  test('the pricing table lists the plans with no button to select one', () => {
    render(<PricingTable onSelectPlan={jest.fn()} />)

    expect(document.querySelector('[data-cy="pricing-plan-pro"]')).not.toBeNull()
    expect(document.querySelector('[data-cy="pricing-plan-free"]')).not.toBeNull()
    expect(document.querySelector('[data-cy^="pricing-select-"]')).toBeNull()
  })

  test('the portal button renders nothing', () => {
    const { container } = render(<ManageBillingButton />)

    expect(container).toBeEmptyDOMElement()
  })
})

describe('with a gateway', () => {
  test('the pricing table keeps its select buttons and the portal button shows', () => {
    mockRegistry.provider = 'stripe'

    render(<PricingTable onSelectPlan={jest.fn()} />)
    expect(document.querySelector('[data-cy="pricing-select-pro"]')).not.toBeNull()

    const { container } = render(<ManageBillingButton />)
    expect(container).not.toBeEmptyDOMElement()
  })
})
