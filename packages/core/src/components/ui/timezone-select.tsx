"use client"

import * as React from "react"
import { Globe } from "lucide-react"
import { Combobox, ComboboxOption } from './combobox'
import { cn } from '../../lib/utils'

// Comprehensive timezone list
const timezones: ComboboxOption[] = [
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (GMT-3)", description: "Argentina Standard Time" },
  { value: "America/New_York", label: "New York (GMT-5)", description: "Eastern Standard Time" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-8)", description: "Pacific Standard Time" },
  { value: "America/Chicago", label: "Chicago (GMT-6)", description: "Central Standard Time" },
  { value: "America/Denver", label: "Denver (GMT-7)", description: "Mountain Standard Time" },
  { value: "America/Mexico_City", label: "Mexico City (GMT-6)", description: "Central Standard Time" },
  { value: "America/Lima", label: "Lima (GMT-5)", description: "Peru Time" },
  { value: "America/Bogota", label: "Bogotá (GMT-5)", description: "Colombia Time" },
  { value: "America/Santiago", label: "Santiago (GMT-4)", description: "Chile Standard Time" },
  { value: "America/Caracas", label: "Caracas (GMT-4)", description: "Venezuela Time" },
  { value: "America/Sao_Paulo", label: "São Paulo (GMT-3)", description: "Brasilia Time" },
  { value: "Europe/London", label: "London (GMT+0)", description: "Greenwich Mean Time" },
  { value: "Europe/Madrid", label: "Madrid (GMT+1)", description: "Central European Time" },
  { value: "Europe/Paris", label: "Paris (GMT+1)", description: "Central European Time" },
  { value: "Europe/Berlin", label: "Berlin (GMT+1)", description: "Central European Time" },
  { value: "Europe/Rome", label: "Rome (GMT+1)", description: "Central European Time" },
  { value: "Europe/Moscow", label: "Moscow (GMT+3)", description: "Moscow Standard Time" },
  { value: "Asia/Tokyo", label: "Tokyo (GMT+9)", description: "Japan Standard Time" },
  { value: "Asia/Shanghai", label: "Shanghai (GMT+8)", description: "China Standard Time" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (GMT+8)", description: "Hong Kong Time" },
  { value: "Asia/Singapore", label: "Singapore (GMT+8)", description: "Singapore Standard Time" },
  { value: "Asia/Mumbai", label: "Mumbai (GMT+5:30)", description: "India Standard Time" },
  { value: "Asia/Dubai", label: "Dubai (GMT+4)", description: "Gulf Standard Time" },
  { value: "Australia/Sydney", label: "Sydney (GMT+10)", description: "Australian Eastern Standard Time" },
  { value: "Australia/Melbourne", label: "Melbourne (GMT+10)", description: "Australian Eastern Standard Time" },
  { value: "Pacific/Auckland", label: "Auckland (GMT+12)", description: "New Zealand Standard Time" },
  { value: "Africa/Cairo", label: "Cairo (GMT+2)", description: "Eastern European Time" },
  { value: "Africa/Johannesburg", label: "Johannesburg (GMT+2)", description: "South Africa Standard Time" },
  { value: "UTC", label: "UTC (GMT+0)", description: "Coordinated Universal Time" },
]

interface TimezoneSelectProps {
  value: string | undefined
  onChange: (value: string | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  clearable?: boolean
}

export function TimezoneSelect({
  value,
  onChange,
  placeholder = "Seleccionar zona horaria...",
  disabled = false,
  className,
  clearable = true,
}: TimezoneSelectProps) {
  return (
    <div className="relative">
      <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
      <Combobox
        options={timezones}
        value={value}
        onChange={(value) => onChange(value as string | undefined)}
        placeholder={placeholder}
        searchPlaceholder="Buscar zona horaria..."
        emptyMessage="No se encontraron zonas horarias."
        disabled={disabled}
        clearable={clearable}
        className={cn("pl-10", className)}
      />
    </div>
  )
}
