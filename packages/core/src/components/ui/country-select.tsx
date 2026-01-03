"use client"

import * as React from "react"
import { Globe2 } from "lucide-react"
import { Combobox, ComboboxOption } from './combobox'
import { cn } from '../../lib/utils'

// Countries list
const countries: ComboboxOption[] = [
  { value: "AR", label: "Argentina", description: "South America" },
  { value: "US", label: "United States", description: "North America" },
  { value: "CA", label: "Canada", description: "North America" },
  { value: "MX", label: "Mexico", description: "North America" },
  { value: "BR", label: "Brazil", description: "South America" },
  { value: "CL", label: "Chile", description: "South America" },
  { value: "CO", label: "Colombia", description: "South America" },
  { value: "PE", label: "Peru", description: "South America" },
  { value: "UY", label: "Uruguay", description: "South America" },
  { value: "PY", label: "Paraguay", description: "South America" },
  { value: "BO", label: "Bolivia", description: "South America" },
  { value: "VE", label: "Venezuela", description: "South America" },
  { value: "EC", label: "Ecuador", description: "South America" },
  { value: "GY", label: "Guyana", description: "South America" },
  { value: "SR", label: "Suriname", description: "South America" },
  { value: "GF", label: "French Guiana", description: "South America" },
  { value: "ES", label: "Spain", description: "Europe" },
  { value: "FR", label: "France", description: "Europe" },
  { value: "DE", label: "Germany", description: "Europe" },
  { value: "IT", label: "Italy", description: "Europe" },
  { value: "GB", label: "United Kingdom", description: "Europe" },
  { value: "PT", label: "Portugal", description: "Europe" },
  { value: "NL", label: "Netherlands", description: "Europe" },
  { value: "BE", label: "Belgium", description: "Europe" },
  { value: "CH", label: "Switzerland", description: "Europe" },
  { value: "AT", label: "Austria", description: "Europe" },
  { value: "SE", label: "Sweden", description: "Europe" },
  { value: "NO", label: "Norway", description: "Europe" },
  { value: "DK", label: "Denmark", description: "Europe" },
  { value: "FI", label: "Finland", description: "Europe" },
  { value: "PL", label: "Poland", description: "Europe" },
  { value: "CZ", label: "Czech Republic", description: "Europe" },
  { value: "HU", label: "Hungary", description: "Europe" },
  { value: "RO", label: "Romania", description: "Europe" },
  { value: "BG", label: "Bulgaria", description: "Europe" },
  { value: "HR", label: "Croatia", description: "Europe" },
  { value: "SI", label: "Slovenia", description: "Europe" },
  { value: "SK", label: "Slovakia", description: "Europe" },
  { value: "EE", label: "Estonia", description: "Europe" },
  { value: "LV", label: "Latvia", description: "Europe" },
  { value: "LT", label: "Lithuania", description: "Europe" },
  { value: "IE", label: "Ireland", description: "Europe" },
  { value: "GR", label: "Greece", description: "Europe" },
  { value: "CY", label: "Cyprus", description: "Europe" },
  { value: "MT", label: "Malta", description: "Europe" },
  { value: "LU", label: "Luxembourg", description: "Europe" },
  { value: "RU", label: "Russia", description: "Europe/Asia" },
  { value: "UA", label: "Ukraine", description: "Europe" },
  { value: "BY", label: "Belarus", description: "Europe" },
  { value: "MD", label: "Moldova", description: "Europe" },
  { value: "CN", label: "China", description: "Asia" },
  { value: "JP", label: "Japan", description: "Asia" },
  { value: "KR", label: "South Korea", description: "Asia" },
  { value: "IN", label: "India", description: "Asia" },
  { value: "ID", label: "Indonesia", description: "Asia" },
  { value: "TH", label: "Thailand", description: "Asia" },
  { value: "MY", label: "Malaysia", description: "Asia" },
  { value: "SG", label: "Singapore", description: "Asia" },
  { value: "PH", label: "Philippines", description: "Asia" },
  { value: "VN", label: "Vietnam", description: "Asia" },
  { value: "KH", label: "Cambodia", description: "Asia" },
  { value: "LA", label: "Laos", description: "Asia" },
  { value: "MM", label: "Myanmar", description: "Asia" },
  { value: "BD", label: "Bangladesh", description: "Asia" },
  { value: "PK", label: "Pakistan", description: "Asia" },
  { value: "LK", label: "Sri Lanka", description: "Asia" },
  { value: "NP", label: "Nepal", description: "Asia" },
  { value: "BT", label: "Bhutan", description: "Asia" },
  { value: "AU", label: "Australia", description: "Oceania" },
  { value: "NZ", label: "New Zealand", description: "Oceania" },
  { value: "FJ", label: "Fiji", description: "Oceania" },
  { value: "PG", label: "Papua New Guinea", description: "Oceania" },
  { value: "ZA", label: "South Africa", description: "Africa" },
  { value: "EG", label: "Egypt", description: "Africa" },
  { value: "NG", label: "Nigeria", description: "Africa" },
  { value: "KE", label: "Kenya", description: "Africa" },
  { value: "ET", label: "Ethiopia", description: "Africa" },
  { value: "GH", label: "Ghana", description: "Africa" },
  { value: "UG", label: "Uganda", description: "Africa" },
  { value: "TZ", label: "Tanzania", description: "Africa" },
  { value: "RW", label: "Rwanda", description: "Africa" },
  { value: "ZW", label: "Zimbabwe", description: "Africa" },
  { value: "BW", label: "Botswana", description: "Africa" },
  { value: "NA", label: "Namibia", description: "Africa" },
  { value: "ZM", label: "Zambia", description: "Africa" },
  { value: "MW", label: "Malawi", description: "Africa" },
  { value: "MZ", label: "Mozambique", description: "Africa" },
  { value: "AO", label: "Angola", description: "Africa" },
  { value: "MA", label: "Morocco", description: "Africa" },
  { value: "DZ", label: "Algeria", description: "Africa" },
  { value: "TN", label: "Tunisia", description: "Africa" },
  { value: "LY", label: "Libya", description: "Africa" },
  { value: "AE", label: "United Arab Emirates", description: "Middle East" },
  { value: "SA", label: "Saudi Arabia", description: "Middle East" },
  { value: "QA", label: "Qatar", description: "Middle East" },
  { value: "KW", label: "Kuwait", description: "Middle East" },
  { value: "BH", label: "Bahrain", description: "Middle East" },
  { value: "OM", label: "Oman", description: "Middle East" },
  { value: "IL", label: "Israel", description: "Middle East" },
  { value: "JO", label: "Jordan", description: "Middle East" },
  { value: "LB", label: "Lebanon", description: "Middle East" },
  { value: "SY", label: "Syria", description: "Middle East" },
  { value: "IQ", label: "Iraq", description: "Middle East" },
  { value: "IR", label: "Iran", description: "Middle East" },
  { value: "TR", label: "Turkey", description: "Europe/Asia" },
]

interface CountrySelectProps {
  value: string | undefined
  onChange: (value: string | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  clearable?: boolean
}

export function CountrySelect({
  value,
  onChange,
  placeholder = "Seleccionar país...",
  disabled = false,
  className,
  clearable = true,
}: CountrySelectProps) {
  return (
    <div className="relative">
      <Globe2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
      <Combobox
        options={countries}
        value={value}
        onChange={(value) => onChange(value as string | undefined)}
        placeholder={placeholder}
        searchPlaceholder="Buscar país..."
        emptyMessage="No se encontraron países."
        disabled={disabled}
        clearable={clearable}
        className={cn("pl-10", className)}
      />
    </div>
  )
}
