'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'

export interface StatusOption {
  value: string
  label: string
}

export interface StatusSelectorProps {
  value: string
  onChange: (status: string) => void
  disabled?: boolean
  options: StatusOption[]
}

export function StatusSelector({ value, onChange, disabled, options }: StatusSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[140px] h-8" data-cy="status-selector">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            data-cy={`status-option-${option.value}`}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
