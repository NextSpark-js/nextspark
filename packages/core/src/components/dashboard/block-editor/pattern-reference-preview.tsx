'use client'

import { Suspense } from 'react'
import { Layers, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import type { PatternReference } from '../../../types/pattern-reference'
import type { BlockInstance } from '../../../types/blocks'
import { getBlockComponent, normalizeBlockProps } from '../../../lib/blocks/loader'

interface PatternReferencePreviewProps {
  patternRef: PatternReference
  isSelected: boolean
  onSelect: () => void
  onRemove?: () => void
}

// Loading skeleton for pattern
function PatternLoadingSkeleton() {
  return (
    <div className="w-full py-12 px-4 animate-pulse bg-muted/20 border-2 border-dashed border-muted-foreground/30 rounded-lg">
      <div className="max-w-7xl mx-auto">
        <div className="h-8 bg-muted rounded w-3/4 mb-4" />
        <div className="h-4 bg-muted rounded w-full mb-2" />
        <div className="h-4 bg-muted rounded w-5/6" />
      </div>
    </div>
  )
}

// Block skeleton
function BlockSkeleton() {
  return (
    <div className="w-full py-12 px-4 animate-pulse">
      <div className="max-w-7xl mx-auto">
        <div className="h-8 bg-muted rounded w-3/4 mb-4" />
        <div className="h-4 bg-muted rounded w-full mb-2" />
        <div className="h-4 bg-muted rounded w-5/6" />
      </div>
    </div>
  )
}

// Helper to get team ID from localStorage
function getTeamId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeTeamId')
  }
  return null
}

// Helper to build headers with team context
function buildApiHeaders(): HeadersInit {
  const headers: Record<string, string> = {}
  const teamId = getTeamId()
  if (teamId) {
    headers['x-team-id'] = teamId
  }
  return headers
}

export function PatternReferencePreview({
  patternRef,
  isSelected,
  onSelect,
  onRemove,
}: PatternReferencePreviewProps) {
  const t = useTranslations('patterns')

  // Fetch pattern data
  const { data: patternData, isLoading, isError } = useQuery({
    queryKey: ['patterns', patternRef.ref],
    queryFn: async () => {
      const response = await fetch(`/api/v1/patterns/${patternRef.ref}`, {
        headers: buildApiHeaders(),
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch pattern: ${response.statusText}`)
      }
      return response.json()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Loading state
  if (isLoading) {
    return <PatternLoadingSkeleton />
  }

  // Error state
  if (isError || !patternData?.data) {
    return (
      <div
        className="w-full py-12 px-4 bg-destructive/10 border-2 border-dashed border-destructive/20 rounded-lg"
        onClick={onSelect}
        data-cy={sel('blockEditor.patternReference.container', { ref: patternRef.ref })}
      >
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-destructive">
            {t('messages.notFound')}
          </p>
          {onRemove && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              data-cy={sel('blockEditor.patternReference.remove', { ref: patternRef.ref })}
            >
              {t('actions.removeReference')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  const pattern = patternData.data

  return (
    <div
      className={cn(
        'group relative cursor-pointer transition-all',
        'border-2 rounded-lg overflow-hidden',
        isSelected ? 'border-primary border-solid' : 'border-dashed border-muted-foreground/30',
        'hover:border-primary/50'
      )}
      onClick={onSelect}
      data-cy={sel('blockEditor.patternReference.container', { ref: patternRef.ref })}
    >
      {/* Pattern badge (bottom-left) - positioned to not cover block controls */}
      <div
        className="absolute bottom-2 left-2 z-20 bg-primary text-primary-foreground text-xs px-2 py-1 rounded shadow-md flex items-center gap-1"
        data-cy={sel('blockEditor.patternReference.badge', { ref: patternRef.ref })}
      >
        <Layers className="h-3 w-3" />
        <span>{t('labels.patternPrefix')}: {pattern.title}</span>
      </div>

      {/* Edit pattern link (top-right, visible on hover/select) */}
      <div
        className={cn(
          'absolute top-2 right-2 z-20 flex items-center gap-2 transition-opacity',
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
      >
        <Button
          variant="secondary"
          size="sm"
          className="h-6 text-xs shadow-md"
          asChild
          onClick={(e) => e.stopPropagation()}
          data-cy={sel('blockEditor.patternReference.editLink', { ref: patternRef.ref })}
        >
          <Link href={`/dashboard/patterns/${patternRef.ref}/edit`} target="_blank" rel="noopener noreferrer">
            {t('actions.editPattern')} →
          </Link>
        </Button>
        {onRemove && (
          <Button
            variant="destructive"
            size="icon"
            className="h-6 w-6 shadow-md"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            data-cy={sel('blockEditor.patternReference.remove', { ref: patternRef.ref })}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Render pattern blocks (read-only visual, always visible) */}
      <div className="pointer-events-none">
        {pattern.blocks?.map((block: BlockInstance) => {
          const BlockComponent = getBlockComponent(block.blockSlug)

          if (!BlockComponent) {
            return (
              <div
                key={block.id}
                className="w-full py-8 px-4 bg-destructive/10 border border-destructive/20"
              >
                <div className="max-w-7xl mx-auto text-center">
                  <p className="text-destructive text-sm">
                    Block not found: <code className="font-mono">{block.blockSlug}</code>
                  </p>
                </div>
              </div>
            )
          }

          const normalizedProps = normalizeBlockProps(block.props)

          return (
            <Suspense key={block.id} fallback={<BlockSkeleton />}>
              <BlockComponent {...normalizedProps} />
            </Suspense>
          )
        })}

        {(!pattern.blocks || pattern.blocks.length === 0) && (
          <div className="w-full py-12 px-4 text-center text-muted-foreground text-sm">
            {t('messages.emptyPattern')}
          </div>
        )}
      </div>
    </div>
  )
}
