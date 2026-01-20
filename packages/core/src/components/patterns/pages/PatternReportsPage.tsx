/**
 * Pattern Usage Reports Page
 *
 * Shows detailed usage reports for a specific pattern.
 * Displays stats cards and a table of entities using the pattern.
 * Uses useEntityConfig hook for entity configuration.
 */

'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit, LayoutGrid } from 'lucide-react'
import { PatternUsageReport } from '../PatternUsageReport'
import { Button } from '../../ui/button'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Skeleton } from '../../ui/skeleton'
import { useEntityConfig } from '../../../hooks/useEntityConfig'
import { getEntityData } from '../../../lib/api/entities'

interface PatternData {
  id: string
  name?: string
  title?: string
}

export default function PatternReportsPage() {
  const params = useParams()
  const router = useRouter()
  const patternId = params.id as string

  const [pattern, setPattern] = useState<PatternData | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Use the centralized hook for entity configuration
  const { config: entityConfig, isLoading: configLoading } = useEntityConfig('patterns')

  useEffect(() => {
    async function loadPattern() {
      if (!patternId) {
        setError('Pattern ID is required')
        setDataLoading(false)
        return
      }

      if (!entityConfig) {
        return
      }

      if (!entityConfig.enabled) {
        setError('Patterns entity is not configured or not enabled')
        setDataLoading(false)
        return
      }

      try {
        // Load pattern data
        const data = await getEntityData('patterns', patternId, false) as PatternData
        setPattern(data)
      } catch (err) {
        console.error('Error loading pattern:', err)
        setError(err instanceof Error ? err.message : 'Failed to load pattern')
      } finally {
        setDataLoading(false)
      }
    }

    if (entityConfig) {
      loadPattern()
    }
  }, [patternId, entityConfig])

  if (configLoading || dataLoading) {
    return (
      <div className="p-6 space-y-6" data-cy="pattern-reports-loading">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6" data-cy="pattern-reports-error">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/dashboard/patterns')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Patterns
        </Button>
      </div>
    )
  }

  if (!pattern) {
    return (
      <div className="p-6" data-cy="pattern-reports-not-found">
        <Alert>
          <AlertTitle>Pattern Not Found</AlertTitle>
          <AlertDescription>
            The pattern you are looking for does not exist or has been deleted.
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/dashboard/patterns')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Patterns
        </Button>
      </div>
    )
  }

  const patternName = pattern.name || pattern.title || pattern.id

  return (
    <div className="p-6 space-y-6" data-cy="pattern-reports-page">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            asChild
            data-cy="pattern-reports-back"
          >
            <Link href="/dashboard/patterns">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-bold tracking-tight" data-cy="pattern-reports-title">
                {patternName}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Usage reports and analytics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild data-cy="pattern-reports-edit">
            <Link href={`/dashboard/patterns/${patternId}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Pattern
            </Link>
          </Button>
        </div>
      </div>

      {/* Usage Report */}
      <PatternUsageReport patternId={patternId} pageSize={20} />
    </div>
  )
}
