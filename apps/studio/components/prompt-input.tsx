'use client'

import { useState } from 'react'
import { ArrowUp } from 'lucide-react'

interface PromptInputProps {
  onSubmit: (prompt: string) => void
  disabled?: boolean
}

export function PromptInput({ onSubmit, disabled }: PromptInputProps) {
  const [value, setValue] = useState('')

  function handleSubmit() {
    if (!value.trim() || disabled) return
    onSubmit(value.trim())
    setValue('')
  }

  return (
    <div className="border-t border-border bg-bg-surface p-4">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="Describe what you want to change..."
          rows={2}
          disabled={disabled}
          className="w-full resize-none rounded-lg border border-border bg-bg p-3 pr-12 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
