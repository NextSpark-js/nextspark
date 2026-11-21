import { notFound } from 'next/navigation'

/**
 * Every superadmin URL no other route serves. Next renders an unmatched URL with the root not-found page, outside the
 * area's layout, while a `notFound()` from a page renders the area's own (`../not-found`).
 */
export default function SuperadminUnknownPage() {
  notFound()
}
