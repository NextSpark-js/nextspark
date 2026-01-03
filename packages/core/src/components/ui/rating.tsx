"use client"

import * as React from "react"
import { Star } from "lucide-react"
import { cn } from '../../lib/utils'

interface RatingProps {
  value: number
  onChange?: (value: number) => void
  max?: number
  size?: "sm" | "md" | "lg"
  readonly?: boolean
  disabled?: boolean
  allowHalf?: boolean
  showValue?: boolean
  className?: string
}

export function Rating({
  value = 0,
  onChange,
  max = 5,
  size = "md",
  readonly = false,
  disabled = false,
  allowHalf = false,
  showValue = false,
  className,
}: RatingProps) {
  const [hoverValue, setHoverValue] = React.useState(0)

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5", 
    lg: "h-6 w-6"
  }

  const handleStarClick = (starValue: number) => {
    if (readonly || disabled || !onChange) return
    onChange(starValue)
  }

  const handleStarHover = (starValue: number) => {
    if (readonly || disabled) return
    setHoverValue(starValue)
  }

  const handleMouseLeave = () => {
    if (readonly || disabled) return
    setHoverValue(0)
  }

  const getStarFill = (starIndex: number) => {
    const currentValue = hoverValue || value
    
    if (allowHalf) {
      if (currentValue >= starIndex) return "full"
      if (currentValue >= starIndex - 0.5) return "half"
      return "empty"
    } else {
      return currentValue >= starIndex ? "full" : "empty"
    }
  }

  const stars = Array.from({ length: max }, (_, index) => {
    const starValue = index + 1
    const halfStarValue = index + 0.5
    const fill = getStarFill(starValue)

    return (
      <div
        key={index}
        className="relative inline-block"
        onMouseLeave={handleMouseLeave}
      >
        {allowHalf && (
          <div
            className="absolute inset-0 w-1/2 z-10 cursor-pointer"
            onClick={() => handleStarClick(halfStarValue)}
            onMouseEnter={() => handleStarHover(halfStarValue)}
          />
        )}
        <Star
          className={cn(
            sizeClasses[size],
            "cursor-pointer transition-colors",
            fill === "full" && "fill-yellow-400 text-yellow-400",
            fill === "half" && "fill-yellow-400/50 text-yellow-400",
            fill === "empty" && "text-gray-300",
            (readonly || disabled) && "cursor-default",
            disabled && "opacity-50",
            className
          )}
          onClick={() => handleStarClick(starValue)}
          onMouseEnter={() => handleStarHover(starValue)}
        />
        {allowHalf && fill === "half" && (
          <Star
            className={cn(
              sizeClasses[size],
              "absolute inset-0 fill-yellow-400 text-yellow-400",
              "clip-path-[polygon(0%_0%,50%_0%,50%_100%,0%_100%)]"
            )}
            style={{
              clipPath: "polygon(0% 0%, 50% 0%, 50% 100%, 0% 100%)"
            }}
          />
        )}
      </div>
    )
  })

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex items-center">
        {stars}
      </div>
      {showValue && (
        <span className="ml-2 text-sm text-muted-foreground">
          {value}/{max}
        </span>
      )}
    </div>
  )
}

