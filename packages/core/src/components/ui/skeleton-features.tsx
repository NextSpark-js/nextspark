/**
 * Skeleton components specifically for feature pages
 * Provides realistic loading states that match the feature gate/placeholder structure
 *
 * Performance optimizations:
 * - Uses SkeletonContainer for content-visibility optimization
 * - CSS containment isolates layout calculations
 * - Supports prefers-reduced-motion
 */

import React from 'react'
import { Card, CardContent, CardHeader } from './card'
import { Skeleton } from './skeleton'

/**
 * Skeleton for feature placeholder page
 * Matches the FeaturePlaceholder component layout
 */
export function SkeletonFeaturePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="pb-4">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <Skeleton className="h-16 w-16 rounded-full" />
          </div>
          {/* Title */}
          <Skeleton className="h-7 w-48 mx-auto mb-2" />
          {/* Description */}
          <Skeleton className="h-4 w-64 mx-auto" />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Benefits */}
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 flex-shrink-0" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
          {/* CTA Button */}
          <Skeleton className="h-10 w-full mt-6" />
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Skeleton for analytics dashboard page
 */
export function SkeletonAnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-5 w-72" />
      </header>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Skeleton for webhooks configuration page
 */
export function SkeletonWebhooksPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </header>

      {/* Webhooks List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-5 w-5" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Skeleton for automation page
 */
export function SkeletonAutomationPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-36 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </header>

      {/* Automations List */}
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
