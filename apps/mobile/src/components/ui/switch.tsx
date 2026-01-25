/**
 * Switch Component - Toggle switch
 * Following shadcn/ui patterns for React Native
 */

import { Pressable, View, type PressableProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { cn } from "@/src/lib/utils";

export interface SwitchProps extends Omit<PressableProps, "onPress"> {
  className?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({
  className,
  checked = false,
  onCheckedChange,
  disabled,
  ...props
}: SwitchProps) {
  const translateX = useSharedValue(checked ? 20 : 0);

  useEffect(() => {
    translateX.value = withTiming(checked ? 20 : 0, { duration: 200 });
  }, [checked, translateX]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Pressable
      className={cn(
        "h-6 w-11 rounded-full p-0.5",
        checked ? "bg-primary" : "bg-input",
        disabled && "opacity-50",
        className
      )}
      onPress={() => onCheckedChange?.(!checked)}
      disabled={disabled}
      {...props}
    >
      <Animated.View
        style={thumbStyle}
        className="h-5 w-5 rounded-full bg-white shadow-sm"
      />
    </Pressable>
  );
}
