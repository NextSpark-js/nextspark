/**
 * Badge Component - Web version
 * Status and label indicators using Tailwind + CVA
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-border bg-transparent text-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        success: "bg-green-500 text-white",
        // Status variants
        todo: "bg-gray-500/20 text-gray-600",
        "in-progress": "bg-blue-500/20 text-blue-600",
        review: "bg-amber-500/20 text-amber-600",
        done: "bg-green-500/20 text-green-600",
        blocked: "bg-red-500/20 text-red-600",
        // Priority variants
        low: "bg-gray-500/20 text-gray-600",
        medium: "bg-blue-500/20 text-blue-600",
        high: "bg-amber-500/20 text-amber-600",
        urgent: "bg-red-500/20 text-red-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const dotColors: Record<string, string> = {
  todo: "bg-gray-500",
  "in-progress": "bg-blue-500",
  review: "bg-amber-500",
  done: "bg-green-500",
  blocked: "bg-red-500",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  showDot?: boolean;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, showDot, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
        {showDot && variant && dotColors[variant] && (
          <div className={cn("mr-1.5 h-1.5 w-1.5 rounded-full", dotColors[variant])} />
        )}
        {children}
      </div>
    );
  }
);

Badge.displayName = "Badge";

export { Badge, badgeVariants };
