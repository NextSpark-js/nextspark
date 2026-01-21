import { cn } from '../../lib/utils'

/**
 * Optimized Skeleton component for improved INP (Interaction to Next Paint)
 *
 * Performance optimizations:
 * - CSS containment isolates layout/paint calculations
 * - content-visibility:auto skips rendering for off-screen elements
 * - GPU-accelerated opacity animation with will-change hint
 * - will-change hint pre-optimizes composition layer
 * - Respects prefers-reduced-motion for accessibility
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
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
  )
}

/**
 * SkeletonContainer - Wraps multiple skeletons with content-visibility optimization
 * Use this for lists or grids of skeleton items to improve rendering performance
 */
function SkeletonContainer({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "skeleton-container",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * SkeletonText - Optimized skeleton for text content
 * Pre-sized for common text patterns to reduce layout shift
 */
function SkeletonText({
  className,
  lines = 1,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
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
  )
}

export { Skeleton, SkeletonContainer, SkeletonText }
