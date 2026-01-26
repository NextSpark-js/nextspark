import * as React from "react"
import { cn } from "../utils"

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  label?: string
  error?: string
  required?: boolean
  containerClassName?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, required, containerClassName, ...props }, ref) => {
    return (
      <div className={cn("space-y-1.5", containerClassName)}>
        {label && (
          <label className="text-sm font-medium leading-none">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}
        <textarea
          className={cn(
            "flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
