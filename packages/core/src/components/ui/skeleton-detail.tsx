/**
 * Skeleton components specifically for entity detail pages
 * Provides realistic loading states that match the actual content structure
 */

'use client'

import React from 'react'
import { Card, CardContent, CardHeader } from './card'
import { Skeleton } from './skeleton'

/**
 * Skeleton for the main entity detail header
 */
export function SkeletonDetailHeader() {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  )
}

/**
 * Skeleton for individual field in detail view
 */
export function SkeletonDetailField({ isLarge = false }: { isLarge?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className={`${isLarge ? 'h-16' : 'h-5'} w-full`} />
    </div>
  )
}

/**
 * Skeleton for a detail card section
 */
export function SkeletonDetailCard({ 
  fieldCount = 4 
}: { 
  fieldCount?: number 
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: fieldCount }).map((_, index) => (
          <SkeletonDetailField key={index} isLarge={index === 1 || index === fieldCount - 1} />
        ))}
      </CardContent>
    </Card>
  )
}

/**
 * Skeleton for metadata sidebar
 */
export function SkeletonMetadata() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Complete skeleton for entity detail page
 * Matches the layout of EntityDetail (p-6 + max-w-7xl mx-auto, full width content)
 */
export function SkeletonEntityDetail() {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <SkeletonDetailHeader />

        {/* Main Content - Full Width */}
        <SkeletonDetailCard fieldCount={6} />
      </div>
    </div>
  )
}
