'use client'

import { Suspense } from 'react'
import { SellerSettings } from '../../../../components/SellerSettings'
import { MarketplaceMessages } from '../../../../components/shared'

export default function MarketplaceSettingsPage() {
  return (
    <MarketplaceMessages>
      <Suspense>
        <SellerSettings />
      </Suspense>
    </MarketplaceMessages>
  )
}
