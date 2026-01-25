/**
 * Checkbox Component - Simple checkbox
 * Following shadcn/ui patterns for React Native
 */

import { Pressable, View, type PressableProps } from "react-native";
import { cn } from "@/src/lib/utils";
import { Text } from "./text";

export interface CheckboxProps extends Omit<PressableProps, "onPress"> {
  className?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
}

export function Checkbox({
  className,
  checked = false,
  onCheckedChange,
  disabled,
  label,
  ...props
}: CheckboxProps) {
  return (
    <Pressable
      className={cn(
        "flex-row items-center gap-2",
        disabled && "opacity-50",
        className
      )}
      onPress={() => onCheckedChange?.(!checked)}
      disabled={disabled}
      {...props}
    >
      <View
        className={cn(
          "h-5 w-5 items-center justify-center rounded border-2",
          checked
            ? "border-primary bg-primary"
            : "border-input bg-background"
        )}
      >
        {checked && (
          <Text className="text-xs text-primary-foreground">✓</Text>
        )}
      </View>
      {label && <Text className="text-foreground">{label}</Text>}
    </Pressable>
  );
}
