/**
 * Skeleton components specifically for settings pages
 * Provides realistic loading states that match the settings page structure
 *
 * Performance optimizations:
 * - Uses SkeletonContainer for content-visibility optimization
 * - CSS containment isolates layout calculations
 * - Supports prefers-reduced-motion
 */

import React from 'react'
import { Card, CardContent, CardHeader } from './card'
import { Skeleton, SkeletonContainer } from './skeleton'

/**
 * Skeleton for settings navigation card
 */
export function SkeletonSettingsNavCard() {
  return (
    <div className="block p-6 rounded-lg border border-border bg-card">
      <div className="flex items-start gap-4">
        <Skeleton className="h-5 w-5 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton for settings overview page (navigation cards)
 */
export function SkeletonSettingsOverview() {
  return (
    <div data-cy="skeleton-settings-overview" className="max-w-2xl">
      <div className="space-y-6">
        {/* Header */}
        <header>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </header>

        {/* Navigation Cards */}
        <SkeletonContainer className="space-y-4">
          <SkeletonSettingsNavCard />
          <SkeletonSettingsNavCard />
          <SkeletonSettingsNavCard />
          <SkeletonSettingsNavCard />
          <SkeletonSettingsNavCard />
          <SkeletonSettingsNavCard />
        </SkeletonContainer>
      </div>
    </div>
  )
}

/**
 * Skeleton for profile form page
 */
export function SkeletonProfileForm() {
  return (
    <div data-cy="skeleton-profile-form" className="max-w-4xl space-y-6">
      {/* Header */}
      <header>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-5 w-64" />
      </header>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name fields - 2 columns */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          {/* Email, Auth, Verification - 4 columns */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <div className="flex items-center gap-3 py-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <div className="flex items-center gap-3 py-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>

          {/* Language, Country, Timezone - 10 columns */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-10">
            <div className="space-y-2 md:col-span-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2 md:col-span-3">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2 md:col-span-5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 pt-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Skeleton for billing/plans page
 */
export function SkeletonBillingPage() {
  return (
    <div data-cy="skeleton-billing-page" className="max-w-4xl space-y-6">
      {/* Header */}
      <header>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-5 w-64" />
      </header>

      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>

      {/* Plans Grid */}
      <SkeletonContainer className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-20" />
              <div className="flex items-baseline gap-1">
                <Skeleton className="h-10 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </SkeletonContainer>
    </div>
  )
}

/**
 * Skeleton for password change page
 */
export function SkeletonPasswordPage() {
  return (
    <div data-cy="skeleton-password-page" className="max-w-xl space-y-6">
      {/* Header */}
      <header>
        <Skeleton className="h-8 w-40 mb-2" />
        <Skeleton className="h-5 w-56" />
      </header>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-36" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Skeleton for security page (sessions list)
 */
export function SkeletonSecurityPage() {
  return (
    <div data-cy="skeleton-security-page" className="max-w-4xl space-y-6">
      {/* Header */}
      <header>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-5 w-64" />
      </header>

      {/* Sessions Card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <SkeletonContainer className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </SkeletonContainer>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Skeleton for API keys page
 */
export function SkeletonApiKeysPage() {
  return (
    <div data-cy="skeleton-api-keys-page" className="max-w-4xl space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </header>

      {/* Keys List */}
      <Card>
        <CardContent className="p-0">
          <SkeletonContainer className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-5 w-5" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            ))}
          </SkeletonContainer>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Skeleton for notifications page
 */
export function SkeletonNotificationsPage() {
  return (
    <div data-cy="skeleton-notifications-page" className="max-w-2xl space-y-6">
      {/* Header */}
      <header>
        <Skeleton className="h-8 w-36 mb-2" />
        <Skeleton className="h-5 w-64" />
      </header>

      {/* Notification Sections */}
      <SkeletonContainer className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </SkeletonContainer>
    </div>
  )
}

/**
 * Skeleton for teams page
 */
export function SkeletonTeamsPage() {
  return (
    <div data-cy="skeleton-teams-page" className="max-w-4xl space-y-6">
      {/* Header */}
      <header>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-5 w-64" />
      </header>

      {/* Teams List Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <SkeletonContainer className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </div>
            ))}
          </SkeletonContainer>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Skeleton for invoices page
 */
export function SkeletonInvoicesPage() {
  return (
    <div data-cy="skeleton-invoices-page" className="max-w-4xl space-y-6">
      {/* Header */}
      <header>
        <Skeleton className="h-8 w-40 mb-2" />
        <Skeleton className="h-5 w-64" />
      </header>

      {/* Invoices Table Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-36" />
          </div>
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          {/* Table Header */}
          <div className="flex items-center justify-between p-3 border-b bg-muted/50">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          {/* Table Rows */}
          <SkeletonContainer className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </SkeletonContainer>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Skeleton for plans page
 */
export function SkeletonPlansPage() {
  return (
    <div data-cy="skeleton-plans-page" className="max-w-6xl space-y-6">
      {/* Header */}
      <header className="text-center">
        <Skeleton className="h-10 w-64 mx-auto mb-2" />
        <Skeleton className="h-5 w-96 mx-auto" />
      </header>

      {/* Plans Grid */}
      <SkeletonContainer className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className={i === 1 ? 'border-primary' : ''}>
            <CardHeader>
              <Skeleton className="h-6 w-20" />
              <div className="flex items-baseline gap-1 mt-2">
                <Skeleton className="h-10 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-4 w-full mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </SkeletonContainer>
    </div>
  )
}
