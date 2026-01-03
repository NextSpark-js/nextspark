"use client"

import * as React from "react"
import { DollarSign } from "lucide-react"
import { Combobox, ComboboxOption } from './combobox'
import { cn } from '../../lib/utils'

// Currency list with symbols and names
const currencies: ComboboxOption[] = [
  { value: "USD", label: "USD ($)", description: "US Dollar" },
  { value: "EUR", label: "EUR (€)", description: "Euro" },
  { value: "GBP", label: "GBP (£)", description: "British Pound" },
  { value: "ARS", label: "ARS ($)", description: "Argentine Peso" },
  { value: "MXN", label: "MXN ($)", description: "Mexican Peso" },
  { value: "BRL", label: "BRL (R$)", description: "Brazilian Real" },
  { value: "CLP", label: "CLP ($)", description: "Chilean Peso" },
  { value: "COP", label: "COP ($)", description: "Colombian Peso" },
  { value: "PEN", label: "PEN (S/)", description: "Peruvian Sol" },
  { value: "UYU", label: "UYU ($U)", description: "Uruguayan Peso" },
  { value: "VES", label: "VES (Bs)", description: "Venezuelan Bolívar" },
  { value: "CAD", label: "CAD ($)", description: "Canadian Dollar" },
  { value: "JPY", label: "JPY (¥)", description: "Japanese Yen" },
  { value: "CNY", label: "CNY (¥)", description: "Chinese Yuan" },
  { value: "KRW", label: "KRW (₩)", description: "South Korean Won" },
  { value: "INR", label: "INR (₹)", description: "Indian Rupee" },
  { value: "AUD", label: "AUD ($)", description: "Australian Dollar" },
  { value: "NZD", label: "NZD ($)", description: "New Zealand Dollar" },
  { value: "CHF", label: "CHF (Fr)", description: "Swiss Franc" },
  { value: "SEK", label: "SEK (kr)", description: "Swedish Krona" },
  { value: "NOK", label: "NOK (kr)", description: "Norwegian Krone" },
  { value: "DKK", label: "DKK (kr)", description: "Danish Krone" },
  { value: "PLN", label: "PLN (zł)", description: "Polish Zloty" },
  { value: "CZK", label: "CZK (Kč)", description: "Czech Koruna" },
  { value: "HUF", label: "HUF (Ft)", description: "Hungarian Forint" },
  { value: "RUB", label: "RUB (₽)", description: "Russian Ruble" },
  { value: "TRY", label: "TRY (₺)", description: "Turkish Lira" },
  { value: "ZAR", label: "ZAR (R)", description: "South African Rand" },
  { value: "EGP", label: "EGP (£)", description: "Egyptian Pound" },
  { value: "NGN", label: "NGN (₦)", description: "Nigerian Naira" },
  { value: "AED", label: "AED (د.إ)", description: "UAE Dirham" },
  { value: "SAR", label: "SAR (﷼)", description: "Saudi Riyal" },
  { value: "QAR", label: "QAR (﷼)", description: "Qatari Riyal" },
  { value: "KWD", label: "KWD (د.ك)", description: "Kuwaiti Dinar" },
]

interface CurrencySelectProps {
  value: string | undefined
  onChange: (value: string | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  clearable?: boolean
}

export function CurrencySelect({
  value,
  onChange,
  placeholder = "Seleccionar moneda...",
  disabled = false,
  className,
  clearable = true,
}: CurrencySelectProps) {
  return (
    <div className="relative">
      <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
      <Combobox
        options={currencies}
        value={value}
        onChange={(value) => onChange(value as string | undefined)}
        placeholder={placeholder}
        searchPlaceholder="Buscar moneda..."
        emptyMessage="No se encontraron monedas."
        disabled={disabled}
        clearable={clearable}
        className={cn("pl-10", className)}
      />
    </div>
  )
}
