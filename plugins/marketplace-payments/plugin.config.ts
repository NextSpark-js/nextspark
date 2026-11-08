/**
 * Marketplace payments: split a payment between the platform and a seller,
 * with Stripe Connect and MercadoPago. See docs/ for the setup.
 */

import { definePlugin } from '@nextsparkjs/core/types/plugin'
import type { PluginConfig } from '@nextsparkjs/core/types/plugin'

export const marketplacePaymentsPluginConfig: PluginConfig = definePlugin({
  name: 'marketplace-payments',
  capabilities: ['server', 'web'],
  displayName: 'Marketplace Payments',
  version: '1.0.0',
  description: 'Split payments between the platform and connected sellers with Stripe Connect and MercadoPago',
  enabled: true,
  dependencies: [],
  api: {},
  navigation: {
    superadmin: { items: [{ href: '/superadmin/marketplace', label: 'Marketplace', icon: 'Globe' }] },
  },
})

export default marketplacePaymentsPluginConfig
