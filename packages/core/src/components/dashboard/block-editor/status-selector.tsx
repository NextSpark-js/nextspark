'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import { sel } from '../../../lib/test'

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
      <SelectTrigger className="w-[140px] h-8" data-cy={sel('blockEditor.header.statusSelector')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            data-cy={sel('blockEditor.header.statusOption', { value: option.value })}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
