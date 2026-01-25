/**
 * Input Component - TextInput with consistent styling
 * Following shadcn/ui patterns for React Native
 */

import { TextInput, type TextInputProps, View } from "react-native";
import { forwardRef } from "react";
import { cn } from "@/src/lib/utils";
import { Text } from "./text";

export interface InputProps extends TextInputProps {
  className?: string;
  containerClassName?: string;
  label?: string;
  error?: string;
  required?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      className,
      containerClassName,
      label,
      error,
      required,
      editable = true,
      ...props
    },
    ref
  ) => {
    return (
      <View className={cn("gap-2", containerClassName)}>
        {label && (
          <Text variant="label">
            {label}
            {required && <Text className="text-destructive"> *</Text>}
          </Text>
        )}
        <TextInput
          ref={ref}
          className={cn(
            "h-11 rounded-lg border border-input bg-card px-3 text-base text-foreground",
            "placeholder:text-muted-foreground",
            error && "border-destructive",
            !editable && "opacity-50",
            className
          )}
          editable={editable}
          placeholderTextColor="#737373"
          {...props}
        />
        {error && <Text variant="error">{error}</Text>}
      </View>
    );
  }
);

Input.displayName = "Input";
