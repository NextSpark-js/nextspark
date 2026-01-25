/**
 * Skeleton Component - Loading placeholder
 * Following shadcn/ui patterns for React Native
 */

import { View, type ViewProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { useEffect } from "react";
import { cn } from "@/src/lib/utils";

export interface SkeletonProps extends ViewProps {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      false
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={animatedStyle}
      className={cn("rounded-md bg-muted", className)}
      {...props}
    />
  );
}

// Common skeleton patterns
export function SkeletonText({
  className,
  ...props
}: SkeletonProps) {
  return <Skeleton className={cn("h-4 w-3/4", className)} {...props} />;
}

export function SkeletonTitle({
  className,
  ...props
}: SkeletonProps) {
  return <Skeleton className={cn("h-6 w-1/2", className)} {...props} />;
}

export function SkeletonAvatar({
  className,
  ...props
}: SkeletonProps) {
  return <Skeleton className={cn("h-10 w-10 rounded-full", className)} {...props} />;
}

export function SkeletonCard({ className, ...props }: SkeletonProps) {
  return (
    <View className={cn("gap-3 rounded-xl border border-border bg-card p-4", className)} {...props}>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <View className="flex-row gap-2 pt-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </View>
    </View>
  );
}
