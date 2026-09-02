"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { Button } from './button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from './command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover'
import { cn } from '../../lib/utils'

export interface ComboboxOption {
  value: string | number
  label: string
  description?: string
  disabled?: boolean
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string | number | undefined
  onChange: (value: string | number | undefined) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  clearable?: boolean
  className?: string
  /**
   * Id applied to the focusable trigger (role="combobox") so a `<label for>`
   * can target it. Without it the label points at nothing (see #90).
   */
  id?: string
  /** Accessible name for the clear control. */
  clearLabel?: string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Seleccionar opción...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "No se encontraron opciones.",
  disabled = false,
  clearable = false,
  className,
  id,
  clearLabel = "Limpiar selección",
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOption = options.find((option) => option.value === value)
  const showClear = clearable && !disabled && !!selectedOption

  const handleSelect = (optionValue: string | number) => {
    if (disabled) return

    const newValue = value === optionValue ? undefined : optionValue
    onChange(newValue)
    setOpen(false)
  }

  const handleClear = () => {
    if (disabled) return
    onChange(undefined)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/*
        The clear control is a real <button> rendered as a SIBLING of the
        trigger (nesting interactive elements inside the trigger button is
        invalid). It is absolutely positioned over the trigger's right edge
        with a 44x44px hit area (touch-target minimum) — see #90.
      */}
      <div className="relative w-full">
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              showClear && "pr-14",
              disabled && "opacity-50 cursor-not-allowed",
              className
            )}
            disabled={disabled}
          >
            <span className="truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {showClear && (
          <button
            type="button"
            aria-label={clearLabel}
            title={clearLabel}
            onClick={handleClear}
            className="absolute right-7 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.label}
                disabled={option.disabled}
                onSelect={() => handleSelect(option.value)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === option.value ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex flex-col">
                  <span>{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
