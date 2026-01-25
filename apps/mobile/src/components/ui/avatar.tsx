/**
 * Avatar Component - User avatar with fallback
 * Following shadcn/ui patterns for React Native
 */

import { View, Image, type ViewProps, type ImageProps } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/src/lib/utils";
import { Text } from "./text";

const avatarVariants = cva(
  "items-center justify-center overflow-hidden rounded-full",
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

export interface AvatarProps
  extends ViewProps,
    VariantProps<typeof avatarVariants> {
  className?: string;
}

export function Avatar({ className, size, children, ...props }: AvatarProps) {
  return (
    <View className={cn(avatarVariants({ size }), className)} {...props}>
      {children}
    </View>
  );
}

// Avatar Image
export interface AvatarImageProps extends Omit<ImageProps, "source" | "src"> {
  className?: string;
  src?: string | null;
}

export function AvatarImage({ className, src, ...props }: AvatarImageProps) {
  if (!src) return null;

  return (
    <Image
      source={{ uri: src }}
      className={cn("h-full w-full", className)}
      {...props}
    />
  );
}

// Avatar Fallback
export interface AvatarFallbackProps
  extends ViewProps,
    VariantProps<typeof avatarVariants> {
  className?: string;
  children?: React.ReactNode;
}

export function AvatarFallback({
  className,
  size,
  children,
  ...props
}: AvatarFallbackProps) {
  return (
    <View
      className={cn(
        "h-full w-full items-center justify-center bg-accent",
        className
      )}
      {...props}
    >
      {typeof children === "string" ? (
        <Text className={cn(avatarTextVariants({ size }), "text-accent-foreground")}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

// Convenience function to get initials
export function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
