"use client"

import * as React from "react"
import { Phone } from "lucide-react"
import { Input } from './input'
import { cn } from '../../lib/utils'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  showCountryCode?: boolean
  defaultCountry?: string
}

// Basic country codes - you can expand this list
const countryCodes = [
  { code: "+54", country: "AR", name: "Argentina" },
  { code: "+1", country: "US", name: "United States" },
  { code: "+34", country: "ES", name: "España" },
  { code: "+52", country: "MX", name: "México" },
  { code: "+44", country: "GB", name: "United Kingdom" },
  { code: "+33", country: "FR", name: "France" },
  { code: "+49", country: "DE", name: "Germany" },
  { code: "+39", country: "IT", name: "Italy" },
  { code: "+55", country: "BR", name: "Brazil" },
  { code: "+57", country: "CO", name: "Colombia" },
]

export function PhoneInput({
  value = "",
  onChange,
  placeholder = "Número de teléfono",
  disabled = false,
  className,
  showCountryCode = true,
  defaultCountry = "AR",
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = React.useState(
    countryCodes.find(c => c.country === defaultCountry) || countryCodes[0]
  )

  const formatPhoneNumber = (input: string) => {
    // Remove all non-digit characters
    const digits = input.replace(/\D/g, "")
    
    // Basic formatting for demonstration
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    const fullValue = showCountryCode ? `${selectedCountry.code} ${formatted}` : formatted
    onChange(fullValue)
  }

  const displayValue = showCountryCode && value.startsWith(selectedCountry.code)
    ? value.substring(selectedCountry.code.length).trim()
    : value

  return (
    <div className={cn("relative flex", className)}>
      {showCountryCode && (
        <div className="flex items-center border border-r-0 border-input bg-background px-3 rounded-l-md">
          <select
            value={selectedCountry.code}
            onChange={(e) => {
              const country = countryCodes.find(c => c.code === e.target.value)
              if (country) {
                setSelectedCountry(country)
                const phoneOnly = value.replace(/^\+\d+\s*/, "")
                onChange(`${country.code} ${phoneOnly}`)
              }
            }}
            disabled={disabled}
            className="bg-transparent border-0 outline-none text-sm"
          >
            {countryCodes.map((country) => (
              <option key={country.code} value={country.code}>
                {country.code}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="relative flex-1">
        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="tel"
          value={displayValue}
          onChange={handlePhoneChange}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "pl-9",
            showCountryCode ? "rounded-l-none" : "",
            className
          )}
        />
      </div>
    </div>
  )
}

