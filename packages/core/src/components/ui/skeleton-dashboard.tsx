/**
 * Skeleton components specifically for dashboard pages
 * Provides realistic loading states that match the actual dashboard structure
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
 * Skeleton for a single stat card
 */
export function SkeletonStatCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-5 w-20" />
      </CardContent>
    </Card>
  )
}

/**
 * Skeleton for stats grid (4 cards)
 * Uses SkeletonContainer for content-visibility optimization
 */
export function SkeletonStatsGrid() {
  return (
    <SkeletonContainer data-cy="skeleton-stats-grid" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <SkeletonStatCard />
      <SkeletonStatCard />
      <SkeletonStatCard />
      <SkeletonStatCard />
    </SkeletonContainer>
  )
}

/**
 * Skeleton for quick actions section
 */
export function SkeletonQuickActions() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <SkeletonContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 border rounded-lg space-y-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </SkeletonContainer>
      </CardContent>
    </Card>
  )
}

/**
 * Skeleton for activity section
 */
export function SkeletonActivity() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-2 w-2 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Complete skeleton for dashboard home page
 * Matches the layout of the actual dashboard home
 */
export function SkeletonDashboardHome() {
  return (
    <div data-cy="skeleton-dashboard-home" className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="mb-8">
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-80" />
        </div>

        {/* Stats Grid */}
        <SkeletonStatsGrid />

        {/* Quick Actions */}
        <SkeletonQuickActions />

        {/* Activity */}
        <SkeletonActivity />
      </div>
    </div>
  )
}
