/**
 * Card Component - Compound component for content containers
 * Following shadcn/ui patterns for React Native
 */

import { View, type ViewProps, Pressable, type PressableProps } from "react-native";
import { cn } from "@/src/lib/utils";

// Card Root
export interface CardProps extends ViewProps {
  className?: string;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <View
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        className
      )}
      {...props}
    >
      {children}
    </View>
  );
}

// Pressable Card (for clickable cards)
export interface PressableCardProps extends PressableProps {
  className?: string;
  children?: React.ReactNode;
}

export function PressableCard({
  className,
  children,
  ...props
}: PressableCardProps) {
  return (
    <Pressable
      className={cn(
        "rounded-xl border border-border bg-card p-4 active:opacity-80",
        className
      )}
      {...props}
    >
      {children}
    </Pressable>
  );
}

// Card Header
export interface CardHeaderProps extends ViewProps {
  className?: string;
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <View className={cn("mb-3", className)} {...props}>
      {children}
    </View>
  );
}

// Card Title (use with Text component)
export interface CardTitleProps extends ViewProps {
  className?: string;
}

export function CardTitle({ className, children, ...props }: CardTitleProps) {
  return (
    <View className={cn("", className)} {...props}>
      {children}
    </View>
  );
}

// Card Description (use with Text component)
export interface CardDescriptionProps extends ViewProps {
  className?: string;
}

export function CardDescription({
  className,
  children,
  ...props
}: CardDescriptionProps) {
  return (
    <View className={cn("mt-1", className)} {...props}>
      {children}
    </View>
  );
}

// Card Content
export interface CardContentProps extends ViewProps {
  className?: string;
}

export function CardContent({
  className,
  children,
  ...props
}: CardContentProps) {
  return (
    <View className={cn("", className)} {...props}>
      {children}
    </View>
  );
}

// Card Footer
export interface CardFooterProps extends ViewProps {
  className?: string;
}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <View
      className={cn("mt-3 border-t border-border pt-3", className)}
      {...props}
    >
      {children}
    </View>
  );
}
