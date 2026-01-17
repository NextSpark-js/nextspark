/**
 * Patterns Detail Page
 *
 * For builder-enabled entities like patterns, this redirects to edit mode.
 */

import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function PatternDetailPage({ params }: PageProps) {
  const resolvedParams = await params

  // Patterns are builder-enabled, so redirect to edit view
  redirect(`/dashboard/patterns/${resolvedParams.id}/edit`)
}
