/**
 * Skeleton Component - Web version
 * Loading placeholder with animate-pulse
 */
import * as React from "react";
import { cn } from "../utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("animate-pulse rounded-md bg-muted", className)}
        {...props}
      />
    );
  }
);

Skeleton.displayName = "Skeleton";

// Common skeleton patterns
const SkeletonText = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => {
    return <Skeleton ref={ref} className={cn("h-4 w-3/4", className)} {...props} />;
  }
);

SkeletonText.displayName = "SkeletonText";

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

export { Skeleton, SkeletonText, SkeletonTitle, SkeletonAvatar, SkeletonCard };
