"use client"

import * as React from "react"
import { cn } from '../../lib/utils'

interface ButtonGroupOption {
  value: string | number
  label: string
  description?: string
  disabled?: boolean
  dataCy?: string
}

interface ButtonGroupProps {
  options: ButtonGroupOption[]
  value: string | number | undefined
  onChange: (value: string | number | undefined) => void
  disabled?: boolean
  className?: string
  variant?: "default" | "outline" | "secondary"
  size?: "sm" | "default" | "lg"
}

export function ButtonGroup({
  options,
  value,
  onChange,
  disabled = false,
  className,
  variant = "outline",
  size = "default",
}: ButtonGroupProps) {
  const sizeClasses = {
    sm: "h-8 px-3 text-xs",
    default: "h-9 px-4 py-2 text-sm",
    lg: "h-10 px-6 text-base",
  }

  const variantClasses = {
    default: {
      base: "bg-background border border-input hover:bg-accent hover:text-accent-foreground",
      selected: "bg-primary text-primary-foreground border-primary"
    },
    outline: {
      base: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      selected: "bg-accent text-accent-foreground border-accent"
    },
    secondary: {
      base: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      selected: "bg-primary text-primary-foreground"
    }
  }

  return (
    <div
      className={cn(
        "flex rounded-lg overflow-hidden border border-input",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      {options.map((option, index) => {
        const isSelected = value === option.value
        const isDisabled = disabled || option.disabled

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={isDisabled}
            data-cy={option.dataCy}
            className={cn(
              "relative flex-1 inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
              sizeClasses[size],
              isSelected 
                ? variantClasses[variant].selected
                : variantClasses[variant].base,
              index === 0 && "rounded-l-md border-l-0",
              index === options.length - 1 && "rounded-r-md border-r-0",
              index > 0 && index < options.length - 1 && "border-l-0 border-r-0",
              index > 0 && "border-l-0"
            )}
            title={option.description}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

