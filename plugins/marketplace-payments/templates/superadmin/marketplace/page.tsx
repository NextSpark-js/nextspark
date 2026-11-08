'use client'

import { SuperadminOverview } from '../../../components/SuperadminOverview'
import { MarketplaceMessages } from '../../../components/shared'

export default function MarketplaceSuperadminPage() {
  return (
    <MarketplaceMessages>
      <SuperadminOverview />
    </MarketplaceMessages>
  )
}
