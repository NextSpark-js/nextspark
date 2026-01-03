/**
 * Skeleton components specifically for entity form/edit pages
 * Provides realistic loading states that match the actual form structure
 */

'use client'

import React from 'react'
import { Card, CardContent, CardHeader } from './card'
import { Skeleton } from './skeleton'

/**
 * Skeleton for the form page header without action buttons
 */
export function SkeletonFormHeader() {
  return (
    <div className="flex items-center mb-8">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton for form field groups
 */
export function SkeletonFormFieldGroup({ fieldCount = 2 }: { fieldCount?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {Array.from({ length: fieldCount }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton for single form field (full width)
 */
export function SkeletonFormField({ isTextarea = false }: { isTextarea?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className={`${isTextarea ? 'h-24' : 'h-10'} w-full`} />
    </div>
  )
}

/**
 * Skeleton for JSON/array fields
 */
export function SkeletonFormJsonField() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-28" />
      <div className="space-y-1">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-5/6" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    </div>
  )
}

/**
 * Skeleton for form card section
 */
export function SkeletonFormCard({ 
  fieldCount = 6,
  hasTextareas = true,
  hasJsonFields = true
}: { 
  fieldCount?: number
  hasTextareas?: boolean
  hasJsonFields?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* First row - usually name/title fields */}
        <SkeletonFormFieldGroup fieldCount={2} />
        
        {/* Textarea fields */}
        {hasTextareas && (
          <>
            <SkeletonFormField isTextarea />
            <SkeletonFormField isTextarea />
          </>
        )}
        
        {/* More regular fields */}
        <SkeletonFormFieldGroup fieldCount={2} />
        
        {/* JSON/Array fields */}
        {hasJsonFields && (
          <>
            <SkeletonFormJsonField />
            <SkeletonFormFieldGroup fieldCount={2} />
          </>
        )}
        
        {/* Additional fields */}
        {fieldCount > 6 && (
          <SkeletonFormFieldGroup fieldCount={Math.min(fieldCount - 6, 4)} />
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Skeleton for form action buttons at the bottom
 */
export function SkeletonFormActions() {
  return (
    <div className="flex items-center justify-between pt-6 border-t">
      <Skeleton className="h-10 w-24" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

/**
 * Complete skeleton for entity form/edit page
 * Matches the layout of EntityFormWrapper (p-6 + max-w-7xl mx-auto)
 */
export function SkeletonEntityForm({
  fieldCount = 8,
  hasTextareas = true,
  hasJsonFields = true
}: {
  fieldCount?: number
  hasTextareas?: boolean
  hasJsonFields?: boolean
}) {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <SkeletonFormHeader />

        {/* Form Content - Single Column */}
        <div className="space-y-6">
          <SkeletonFormCard
            fieldCount={fieldCount}
            hasTextareas={hasTextareas}
            hasJsonFields={hasJsonFields}
          />

          {/* Form Actions */}
          <SkeletonFormActions />
        </div>
      </div>
    </div>
  )
}
