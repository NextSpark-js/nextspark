import type { Metadata } from 'next'
import { createEntityListPage } from '../../../_internal/entity-list-page'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Manage entities in your dashboard'
}

export default createEntityListPage()
