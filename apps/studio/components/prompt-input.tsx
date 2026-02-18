'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowUp } from 'lucide-react'

const CHAT_SUGGESTIONS = [
  'Add a field to an entity',
  'Create a new entity',
  'Add a new page',
  'Change the billing model',
]

interface PromptInputProps {
  onSubmit: (prompt: string) => void
  disabled?: boolean
  placeholder?: string
  showSuggestions?: boolean
  /** When set, pre-fills the textarea and focuses it. Reset to '' after consuming. */
  prefill?: string
  onPrefillConsumed?: () => void
}

export function PromptInput({ onSubmit, disabled, placeholder, showSuggestions, prefill, onPrefillConsumed }: PromptInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (prefill) {
      setValue(prefill)
      onPrefillConsumed?.()
      // Focus and place cursor at end
      setTimeout(() => {
        textareaRef.current?.focus()
        if (textareaRef.current) {
          textareaRef.current.selectionStart = prefill.length
          textareaRef.current.selectionEnd = prefill.length
        }
      }, 50)
    }
  }, [prefill, onPrefillConsumed])

  function handleSubmit() {
    if (!value.trim() || disabled) return
    onSubmit(value.trim())
    setValue('')
  }

  function handleSuggestion(text: string) {
    if (disabled) return
    setValue(text)
  }

  return (
    <div className="border-t border-border p-2 flex-shrink-0">
      {/* Suggestion chips — shown when project is ready and input is empty */}
      {showSuggestions && !disabled && !value.trim() && (
        <div className="flex flex-wrap gap-1.5 pb-2">
          {CHAT_SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              className="rounded-full border border-border bg-bg-surface/50 px-2.5 py-1 text-[10px] text-text-muted hover:text-text-secondary hover:border-accent/30 hover:bg-accent/5 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="relative flex items-end rounded-lg border border-border bg-bg hover:border-border-strong focus-within:border-accent/40 transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder={placeholder || "Follow up..."}
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
