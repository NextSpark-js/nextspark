/**
 * The `metadata` of every generated dashboard list page (`dashboard/(main)/<entity>/page.tsx`
 * forwards it): the generated host writes one route per entity and none of them declares its own.
 */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Manage entities in your dashboard'
}
