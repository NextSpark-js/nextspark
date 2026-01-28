/**
 * Skeleton Component - Web version
 * Optimized for INP (Interaction to Next Paint)
 *
 * Performance optimizations:
 * - CSS containment isolates layout/paint calculations
 * - content-visibility:auto skips rendering for off-screen elements
 * - GPU-accelerated opacity animation with will-change hint
 * - Respects prefers-reduced-motion for accessibility
 */
import * as React from "react";
import { cn } from "../utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          "rounded-md bg-muted",
          // Optimized animation - GPU accelerated
          "animate-skeleton-pulse",
          // CSS containment for better INP
          "skeleton-contained",
          className
        )}
        {...props}
      />
    );
  }
);

Skeleton.displayName = "Skeleton";

/**
 * SkeletonContainer - Wraps multiple skeletons with content-visibility optimization
 * Use this for lists or grids of skeleton items to improve rendering performance
 */
const SkeletonContainer = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("skeleton-container", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

SkeletonContainer.displayName = "SkeletonContainer";

/**
 * SkeletonText - Optimized skeleton for text content
 * Pre-sized for common text patterns to reduce layout shift
 */
export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

const SkeletonText = React.forwardRef<HTMLDivElement, SkeletonTextProps>(
  ({ className, lines = 1, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-2", className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              "h-4",
              // Last line is typically shorter
              i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
            )}
          />
        ))}
      </div>
    );
  }
);

SkeletonText.displayName = "SkeletonText";

// Simple preset components
const SkeletonTitle = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => {
    return <Skeleton ref={ref} className={cn("h-6 w-1/2", className)} {...props} />;
  }
);

SkeletonTitle.displayName = "SkeletonTitle";

const SkeletonAvatar = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => {
    return <Skeleton ref={ref} className={cn("h-10 w-10 rounded-full", className)} {...props} />;
  }
);

SkeletonAvatar.displayName = "SkeletonAvatar";

const SkeletonCard = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("space-y-3 rounded-xl border border-border bg-card p-4", className)}
        {...props}
      >
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
    );
  }
);

SkeletonCard.displayName = "SkeletonCard";

export {
  Skeleton,
  SkeletonContainer,
  SkeletonText,
  SkeletonTitle,
  SkeletonAvatar,
  SkeletonCard,
};
