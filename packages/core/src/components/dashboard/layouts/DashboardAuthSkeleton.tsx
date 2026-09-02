'use client'

import { Skeleton, SkeletonContainer } from '../../ui/skeleton'

/**
 * Structural skeleton shown while the dashboard auth gate resolves the session.
 *
 * Replaces the bare centered spinner on a blank screen (see #91): a sidebar
 * rail, a topbar strip and a content placeholder give users the shape of what
 * is coming instead of an empty page. Built only from the existing Skeleton
 * primitives (bg-muted + reduced pulse), so it inherits the active theme and
 * stays deliberately restrained — this is seen many times a day.
 *
 * The sidebar rail collapses below the `md:` breakpoint, matching the real
 * dashboard sidebar, so mobile never shows a phantom sidebar block.
 *
 * Shared by AuthGuard, DashboardAuthLayout and the generated
 * app/dashboard/layout.tsx so the public API and the template cannot drift.
 */
export function DashboardAuthSkeleton() {
  return (
    <div
      className="min-h-screen flex bg-background"
      data-cy="dashboard-loading-skeleton"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>

      {/* Sidebar rail */}
      <div
        className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border md:p-4 md:gap-3"
        aria-hidden="true"
      >
        <Skeleton className="h-8 w-32" />
        <SkeletonContainer className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </SkeletonContainer>
      </div>

      {/* Topbar + content column */}
      <div className="flex flex-1 flex-col" aria-hidden="true">
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex-1 p-4 md:p-6">
          <SkeletonContainer className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </SkeletonContainer>
          <Skeleton className="mt-4 h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
