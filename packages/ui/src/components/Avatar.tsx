"use client";

/**
 * Avatar Component - Web version
 * User avatar with fallback using Tailwind
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils";

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full",
  {
    variants: {
      size: {
        sm: "h-8 w-8",
        default: "h-10 w-10",
        lg: "h-12 w-12",
        xl: "h-16 w-16",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const avatarTextVariants = cva("font-semibold text-white", {
  variants: {
    size: {
      sm: "text-xs",
      default: "text-sm",
      lg: "text-base",
      xl: "text-lg",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export type AvatarSize = "sm" | "default" | "lg" | "xl";

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(avatarVariants({ size }), className)} {...props}>
        {children}
      </div>
    );
  }
);

Avatar.displayName = "Avatar";

// Avatar Image
export interface AvatarImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, src, alt = "", ...props }, ref) => {
    const [hasError, setHasError] = React.useState(false);

    if (!src || hasError) return null;

    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        className={cn("aspect-square h-full w-full object-cover", className)}
        onError={() => setHasError(true)}
        {...props}
      />
    );
  }
);

AvatarImage.displayName = "AvatarImage";

// Avatar Fallback
export interface AvatarFallbackProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {}

const AvatarFallback = React.forwardRef<HTMLDivElement, AvatarFallbackProps>(
  ({ className, size, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex h-full w-full items-center justify-center bg-accent",
          className
        )}
        {...props}
      >
        {typeof children === "string" ? (
          <span className={cn(avatarTextVariants({ size }), "text-accent-foreground")}>
            {children}
          </span>
        ) : (
          children
        )}
      </div>
    );
  }
);

AvatarFallback.displayName = "AvatarFallback";

// Convenience function to get initials
function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export { Avatar, AvatarImage, AvatarFallback, getInitials, avatarVariants };
