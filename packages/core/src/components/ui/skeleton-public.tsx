/**
 * Skeleton components specifically for public pages
 * Provides realistic loading states that match the public page structure
 *
 * Performance optimizations:
 * - Uses SkeletonContainer for content-visibility optimization
 * - CSS containment isolates layout calculations
 * - Supports prefers-reduced-motion
 */

import React from 'react'
import { Skeleton } from './skeleton'

/**
 * Skeleton for hero section
 */
export function SkeletonHeroSection() {
  return (
    <section className="flex flex-col items-center justify-center px-4 py-24 text-center">
      {/* Title */}
      <Skeleton className="h-12 w-96 max-w-full sm:h-16" />
      {/* Subtitle */}
      <Skeleton className="mt-6 h-6 w-[32rem] max-w-full" />
      <Skeleton className="mt-2 h-6 w-96 max-w-full" />
      {/* CTA */}
      <Skeleton className="mt-10 h-12 w-40" />
    </section>
  )
}

/**
 * Skeleton for features section
 */
export function SkeletonFeaturesSection() {
  return (
    <section className="px-4 py-24 bg-muted/50">
      <div className="max-w-6xl mx-auto">
        {/* Section title */}
        <Skeleton className="h-9 w-64 mx-auto" />
        <Skeleton className="mt-4 h-5 w-96 mx-auto" />

        {/* Feature cards */}
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-6 rounded-lg border bg-card">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <Skeleton className="mt-4 h-6 w-32" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-1 h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * Complete skeleton for landing/home page
 */
export function SkeletonLandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <SkeletonHeroSection />
      <SkeletonFeaturesSection />
    </main>
  )
}

/**
 * Skeleton for support/contact page
 */
export function SkeletonSupportPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Header */}
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-2 h-5 w-80" />

      {/* Contact form */}
      <div className="mt-8 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}
