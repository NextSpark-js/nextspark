"use client";

/**
 * Checkbox Component - Web version
 * Custom checkbox with Tailwind styling
 */
import * as React from "react";
import { cn } from "../utils";

export interface CheckboxProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, disabled, label, id, ...props }, ref) => {
    const checkboxId = id || React.useId();

    return (
      <div className={cn("flex items-center gap-2", disabled && "opacity-50", className)}>
        <button
          ref={ref}
          type="button"
          role="checkbox"
          aria-checked={checked}
          id={checkboxId}
          disabled={disabled}
          onClick={() => onCheckedChange?.(!checked)}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background"
          )}
          {...props}
        >
          {checked && (
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        {label && (
          <label
            htmlFor={checkboxId}
            className={cn(
              "text-sm cursor-pointer select-none",
              disabled && "cursor-not-allowed"
            )}
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
