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
    <div className="border-t border-border p-2 flex-shrink-0">
      <div className="relative flex items-end rounded-lg border border-border bg-bg hover:border-border-strong focus-within:border-accent/40 transition-colors">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="Follow up..."
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-[12px] text-text-primary placeholder:text-text-muted/50 focus:outline-none disabled:opacity-30 font-sans"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className="m-1.5 flex h-5 w-5 items-center justify-center rounded-md bg-accent text-white transition-all hover:bg-accent-hover disabled:opacity-15 disabled:cursor-not-allowed flex-shrink-0"
        >
          <ArrowUp className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  )
}
