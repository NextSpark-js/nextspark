/**
 * Badge Component - Status and label indicators
 * Following shadcn/ui patterns for React Native
 */

import { View, type ViewProps, Pressable, type PressableProps } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/src/lib/utils";
import { Text } from "./text";

const badgeVariants = cva(
  "flex-row items-center rounded-full px-3 py-1",
  {
    variants: {
      variant: {
        default: "bg-primary",
        secondary: "bg-secondary",
        outline: "border border-border bg-transparent",
        destructive: "bg-destructive",
        success: "bg-success",
        // Status variants
        todo: "bg-gray-500/20",
        "in-progress": "bg-blue-500/20",
        review: "bg-amber-500/20",
        done: "bg-green-500/20",
        blocked: "bg-red-500/20",
        // Priority variants
        low: "bg-gray-500/20",
        medium: "bg-blue-500/20",
        high: "bg-amber-500/20",
        urgent: "bg-red-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const badgeTextVariants = cva("text-xs font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      outline: "text-foreground",
      destructive: "text-destructive-foreground",
      success: "text-success-foreground",
      // Status text variants
      todo: "text-gray-600",
      "in-progress": "text-blue-600",
      review: "text-amber-600",
      done: "text-green-600",
      blocked: "text-red-600",
      // Priority text variants
      low: "text-gray-600",
      medium: "text-blue-600",
      high: "text-amber-600",
      urgent: "text-red-600",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface BadgeProps
  extends ViewProps,
    VariantProps<typeof badgeVariants> {
  className?: string;
  textClassName?: string;
  children?: React.ReactNode;
  showDot?: boolean;
}

export function Badge({
  className,
  textClassName,
  variant,
  children,
  showDot,
  ...props
}: BadgeProps) {
  const dotColors: Record<string, string> = {
    todo: "bg-gray-500",
    "in-progress": "bg-blue-500",
    review: "bg-amber-500",
    done: "bg-green-500",
    blocked: "bg-red-500",
  };

  return (
    <View className={cn(badgeVariants({ variant }), className)} {...props}>
      {showDot && variant && dotColors[variant] && (
        <View className={cn("mr-1.5 h-1.5 w-1.5 rounded-full", dotColors[variant])} />
      )}
      {typeof children === "string" ? (
        <Text className={cn(badgeTextVariants({ variant }), textClassName)}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

// Pressable Badge (for option buttons)
export interface PressableBadgeProps
  extends PressableProps,
    VariantProps<typeof badgeVariants> {
  className?: string;
  textClassName?: string;
  children?: React.ReactNode;
  selected?: boolean;
  selectedVariant?: VariantProps<typeof badgeVariants>["variant"];
}

export function PressableBadge({
  className,
  textClassName,
  variant = "outline",
  selectedVariant,
  children,
  selected,
  ...props
}: PressableBadgeProps) {
  const currentVariant = selected && selectedVariant ? selectedVariant : variant;

  return (
    <Pressable
      className={cn(
        badgeVariants({ variant: currentVariant }),
        "active:opacity-80",
        selected && "border-2",
        className
      )}
      {...props}
    >
      {typeof children === "string" ? (
        <Text className={cn(badgeTextVariants({ variant: currentVariant }), textClassName)}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
