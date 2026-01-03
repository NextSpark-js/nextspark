"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Badge } from './badge'
import { Input } from './input'
import { cn } from '../../lib/utils'

interface TagsInputProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  maxTags?: number
  disabled?: boolean
  className?: string
  allowDuplicates?: boolean
  separator?: string
}

export function TagsInput({
  value = [],
  onChange,
  placeholder = "Agregar tags...",
  maxTags,
  disabled = false,
  className,
  allowDuplicates = false,
  separator = ",",
}: TagsInputProps) {
  const [inputValue, setInputValue] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim()
    if (!trimmedTag) return

    if (!allowDuplicates && value.includes(trimmedTag)) return
    if (maxTags && value.length >= maxTags) return

    onChange([...value, trimmedTag])
    setInputValue("")
  }

  const removeTag = (indexToRemove: number) => {
    if (disabled) return
    onChange(value.filter((_, index) => index !== indexToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === "Enter" || e.key === separator) {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value.length - 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return

    e.preventDefault()
    const paste = e.clipboardData.getData("text")
    const tags = paste.split(separator).map(tag => tag.trim()).filter(Boolean)
    
    const newTags = allowDuplicates 
      ? tags 
      : tags.filter(tag => !value.includes(tag))
    
    const tagsToAdd = maxTags 
      ? newTags.slice(0, maxTags - value.length)
      : newTags

    if (tagsToAdd.length > 0) {
      onChange([...value, ...tagsToAdd])
      setInputValue("")
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-10 w-full flex-wrap gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag, index) => (
        <Badge
          key={index}
          variant="secondary"
          className="text-xs"
        >
          {tag}
          {!disabled && (
            <span
              role="button"
              tabIndex={0}
              className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  removeTag(index)
                }
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                removeTag(index)
              }}
            >
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </span>
          )}
        </Badge>
      ))}
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={value.length === 0 ? placeholder : ""}
        disabled={disabled || !!(maxTags && value.length >= maxTags)}
        className="flex-1 border-0 outline-0 ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-w-[100px]"
      />
    </div>
  )
}
