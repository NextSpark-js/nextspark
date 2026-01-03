'use client'

import { useState, useEffect } from 'react'
import { Textarea } from '../../ui/textarea'
import { Alert, AlertDescription } from '../../ui/alert'
import { AlertCircle } from 'lucide-react'
import { validateJsonBody } from './utils/url-builder'

interface PayloadEditorProps {
  value: string
  onChange: (value: string) => void
}

export function PayloadEditor({ value, onChange }: PayloadEditorProps) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const validationError = validateJsonBody(value)
    setError(validationError)
  }, [value])

  return (
    <div className="space-y-2" data-cy="api-tester-payload">
      <Textarea
        placeholder='{"key": "value"}'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono min-h-[150px] text-sm"
        data-cy="api-tester-payload-textarea"
      />
      {error && (
        <Alert variant="destructive" data-cy="api-tester-payload-error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
