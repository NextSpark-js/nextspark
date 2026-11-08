"use client";

import { Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { cn } from '../../../lib/utils';
import { useMessageText } from '../../../lib/i18n/common-text';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  placeholder?: string;
  label?: string;
  allLabel?: string;
  showIcon?: boolean;
  className?: string;
  "data-cy"?: string;
}

/**
 * FilterDropdown Component
 *
 * Reusable dropdown filter for admin pages.
 * Supports an "All" option that maps to empty string.
 */
export function FilterDropdown({
  value,
  onChange,
  options,
  placeholder: placeholderProp,
  label,
  allLabel: allLabelProp,
  showIcon = true,
  className,
  "data-cy": dataCy,
}: FilterDropdownProps) {
  const defaultPlaceholder = useMessageText('superadmin.filters.placeholder', 'Filter');
  const defaultAllLabel = useMessageText('superadmin.filters.all', 'All');
  const placeholder = placeholderProp ?? defaultPlaceholder;
  const allLabel = allLabelProp ?? defaultAllLabel;
  // Add "All" option at the beginning
  const allOptions: FilterOption[] = [
    { value: "", label: allLabel },
    ...options,
  ];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {label}:
        </span>
      )}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className="h-9 w-[150px]"
          data-cy={dataCy}
        >
          {showIcon && <Filter className="h-4 w-4 mr-2 text-muted-foreground" />}
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allOptions.map((option) => (
            <SelectItem key={option.value || "__all__"} value={option.value || "__all__"}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
