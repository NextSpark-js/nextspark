"use client"

import * as React from "react"
import { MapPin } from "lucide-react"
import { Input } from './input'
import { Label } from './label'
import { Card, CardContent } from './card'
import { cn } from '../../lib/utils'

export interface Address {
  street: string
  city: string
  state: string
  zipCode: string
  country: string
  fullAddress?: string
}

interface AddressInputProps {
  value: Address
  onChange: (address: Address) => void
  disabled?: boolean
  className?: string
  layout?: "inline" | "stacked"
  showFullAddress?: boolean
}

export function AddressInput({
  value = {
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  },
  onChange,
  disabled = false,
  className,
  layout = "stacked",
  showFullAddress = true,
}: AddressInputProps) {
  const updateField = (field: keyof Address, fieldValue: string) => {
    const newAddress = { ...value, [field]: fieldValue }
    
    // Update full address when individual fields change
    if (showFullAddress && field !== 'fullAddress') {
      newAddress.fullAddress = [
        newAddress.street,
        newAddress.city,
        newAddress.state,
        newAddress.zipCode,
        newAddress.country,
      ].filter(Boolean).join(", ")
    }
    
    onChange(newAddress)
  }

  const handleFullAddressChange = (fullAddress: string) => {
    // Simple parsing - you could integrate with a geocoding service here
    const parts = fullAddress.split(",").map(part => part.trim())
    
    const newAddress: Address = {
      ...value,
      fullAddress,
    }

    // Basic parsing attempt
    if (parts.length >= 1) newAddress.street = parts[0] || ""
    if (parts.length >= 2) newAddress.city = parts[1] || ""
    if (parts.length >= 3) newAddress.state = parts[2] || ""
    if (parts.length >= 4) newAddress.zipCode = parts[3] || ""
    if (parts.length >= 5) newAddress.country = parts[4] || ""

    onChange(newAddress)
  }

  if (layout === "inline") {
    return (
      <div className={cn("space-y-4", className)}>
        {showFullAddress && (
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Dirección completa..."
              value={value.fullAddress || ""}
              onChange={(e) => handleFullAddressChange(e.target.value)}
              disabled={disabled}
              className="pl-9"
            />
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            placeholder="Calle"
            value={value.street}
            onChange={(e) => updateField('street', e.target.value)}
            disabled={disabled}
          />
          <Input
            placeholder="Ciudad"
            value={value.city}
            onChange={(e) => updateField('city', e.target.value)}
            disabled={disabled}
          />
          <Input
            placeholder="Estado/Provincia"
            value={value.state}
            onChange={(e) => updateField('state', e.target.value)}
            disabled={disabled}
          />
          <Input
            placeholder="Código Postal"
            value={value.zipCode}
            onChange={(e) => updateField('zipCode', e.target.value)}
            disabled={disabled}
          />
        </div>
        
        <Input
          placeholder="País"
          value={value.country}
          onChange={(e) => updateField('country', e.target.value)}
          disabled={disabled}
        />
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-4">
        {showFullAddress && (
          <div className="space-y-2">
            <Label htmlFor="full-address">Dirección Completa</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="full-address"
                placeholder="Ingresa la dirección completa..."
                value={value.fullAddress || ""}
                onChange={(e) => handleFullAddressChange(e.target.value)}
                disabled={disabled}
                className="pl-9"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="street">Calle y Número</Label>
            <Input
              id="street"
              placeholder="Ej: Av. Corrientes 1234"
              value={value.street}
              onChange={(e) => updateField('street', e.target.value)}
              disabled={disabled}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="city">Ciudad</Label>
            <Input
              id="city"
              placeholder="Ej: Buenos Aires"
              value={value.city}
              onChange={(e) => updateField('city', e.target.value)}
              disabled={disabled}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="state">Estado/Provincia</Label>
            <Input
              id="state"
              placeholder="Ej: CABA"
              value={value.state}
              onChange={(e) => updateField('state', e.target.value)}
              disabled={disabled}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="zipCode">Código Postal</Label>
            <Input
              id="zipCode"
              placeholder="Ej: C1043"
              value={value.zipCode}
              onChange={(e) => updateField('zipCode', e.target.value)}
              disabled={disabled}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="country">País</Label>
            <Input
              id="country"
              placeholder="Ej: Argentina"
              value={value.country}
              onChange={(e) => updateField('country', e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

