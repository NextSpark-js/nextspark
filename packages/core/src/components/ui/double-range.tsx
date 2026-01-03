"use client"

import * as React from "react"
import { cn } from '../../lib/utils'

interface DoubleRangeProps {
  value: [number, number] | undefined
  onChange: (value: [number, number] | undefined) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
  formatLabel?: (value: number) => string
  showLabels?: boolean
}

export function DoubleRange({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className,
  formatLabel = (val) => val.toString(),
  showLabels = true,
}: DoubleRangeProps) {
  const [localValue, setLocalValue] = React.useState<[number, number]>(() => 
    value || [min, max]
  )
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = React.useState<'min' | 'max' | null>(null)

  // Keep a ref to the current localValue to avoid dependency issues
  const localValueRef = React.useRef(localValue)
  localValueRef.current = localValue

  // Only sync from props when not dragging and values are different
  React.useEffect(() => {
    if (value && !isDragging && (value[0] !== localValueRef.current[0] || value[1] !== localValueRef.current[1])) {
      setLocalValue(value)
    }
  }, [value, isDragging])

  const getPercentage = (val: number) => ((val - min) / (max - min)) * 100

  const getValueFromPosition = React.useCallback((clientX: number) => {
    if (!trackRef.current) return min
    
    const rect = trackRef.current.getBoundingClientRect()
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const newValue = min + percentage * (max - min)
    
    // Round to nearest step
    return Math.round(newValue / step) * step
  }, [min, max, step])

  const updateValue = React.useCallback((newRange: [number, number]) => {
    setLocalValue(newRange)
    onChange(newRange)
  }, [onChange])

  const handleMouseDown = (type: 'min' | 'max') => (e: React.MouseEvent) => {
    if (disabled) return
    e.preventDefault()
    setIsDragging(type)
  }

  // Handle mouse events for dragging
  React.useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || disabled) return
      
      const newValue = getValueFromPosition(e.clientX)
      
      setLocalValue(current => {
        const [currentMin, currentMax] = current
        let newRange: [number, number]
        
        if (isDragging === 'min') {
          newRange = [Math.min(newValue, currentMax - step), currentMax]
        } else {
          newRange = [currentMin, Math.max(newValue, currentMin + step)]
        }
        
        onChange(newRange)
        return newRange
      })
    }

    const handleMouseUp = () => {
      setIsDragging(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, getValueFromPosition, step, disabled, onChange])

  const handleTrackClick = React.useCallback((e: React.MouseEvent) => {
    if (disabled || isDragging) return
    
    const newValue = getValueFromPosition(e.clientX)
    const [currentMin, currentMax] = localValue
    const midPoint = (currentMin + currentMax) / 2
    
    let newRange: [number, number]
    
    if (newValue < midPoint) {
      // Closer to min thumb
      newRange = [Math.min(newValue, currentMax - step), currentMax]
    } else {
      // Closer to max thumb
      newRange = [currentMin, Math.max(newValue, currentMin + step)]
    }
    
    updateValue(newRange)
  }, [disabled, isDragging, getValueFromPosition, localValue, step, updateValue])

  const minPercentage = getPercentage(localValue[0])
  const maxPercentage = getPercentage(localValue[1])

  return (
    <div className={cn("space-y-3", disabled && "opacity-50", className)}>
      {showLabels && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{formatLabel(localValue[0])}</span>
          <span>{formatLabel(localValue[1])}</span>
        </div>
      )}
      
      <div className="relative">
        {/* Track */}
        <div
          ref={trackRef}
          className="relative h-2 bg-secondary rounded-full cursor-pointer"
          onClick={handleTrackClick}
        >
          {/* Active range */}
          <div
            className="absolute h-full bg-primary rounded-full"
            style={{
              left: `${minPercentage}%`,
              width: `${maxPercentage - minPercentage}%`,
            }}
          />
          
          {/* Min thumb */}
          <div
            className={cn(
              "absolute w-5 h-5 bg-background border-2 border-primary rounded-full cursor-pointer -top-1.5 transform -translate-x-1/2 transition-all",
              "hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              disabled && "cursor-not-allowed hover:scale-100"
            )}
            style={{ left: `${minPercentage}%` }}
            onMouseDown={handleMouseDown('min')}
            tabIndex={disabled ? -1 : 0}
            role="slider"
            aria-label="Minimum value"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={localValue[0]}
          />
          
          {/* Max thumb */}
          <div
            className={cn(
              "absolute w-5 h-5 bg-background border-2 border-primary rounded-full cursor-pointer -top-1.5 transform -translate-x-1/2 transition-all",
              "hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              disabled && "cursor-not-allowed hover:scale-100"
            )}
            style={{ left: `${maxPercentage}%` }}
            onMouseDown={handleMouseDown('max')}
            tabIndex={disabled ? -1 : 0}
            role="slider"
            aria-label="Maximum value"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={localValue[1]}
          />
        </div>
        
        {/* Min/Max labels */}
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{formatLabel(min)}</span>
          <span>{formatLabel(max)}</span>
        </div>
      </div>
    </div>
  )
}