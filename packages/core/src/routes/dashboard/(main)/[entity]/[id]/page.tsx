import type { Metadata } from 'next'
import { createEntityDetailPage } from '../../../../_internal/entity-detail-page'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'View entity details'
}

export default createEntityDetailPage()
