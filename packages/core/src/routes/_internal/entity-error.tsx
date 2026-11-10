'use client'

import { useEffect } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function EntityError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const text = useTranslations('entities.errorPage')
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Entity page error:', error)
  }, [error])
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">{text('title')}</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {error.message || text('fallbackMessage')}
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => window.history.back()}
        >
          {text('goBack')}
        </Button>
        <Button
          onClick={() => reset()}
        >
          {text('tryAgain')}
        </Button>
      </div>
      
      {process.env.NODE_ENV === 'development' && error.stack && (
        <details className="mt-4 p-4 bg-muted rounded-lg text-xs max-w-2xl w-full">
          <summary className="cursor-pointer font-medium">{text('details')}</summary>
          <pre className="mt-2 overflow-auto">{error.stack}</pre>
        </details>
      )}
    </div>
  )
}