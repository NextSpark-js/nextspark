/**
 * Textarea Component - Multiline TextInput
 * Following shadcn/ui patterns for React Native
 */

import { TextInput, type TextInputProps, View } from "react-native";
import { forwardRef } from "react";
import { cn } from "@/src/lib/utils";
import { Text } from "./text";

export interface TextareaProps extends TextInputProps {
  className?: string;
  containerClassName?: string;
  label?: string;
  error?: string;
  required?: boolean;
}

export const Textarea = forwardRef<TextInput, TextareaProps>(
  (
    {
      className,
      containerClassName,
      label,
      error,
      required,
      editable = true,
      numberOfLines = 4,
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
            "min-h-[100px] rounded-lg border border-input bg-card px-3 py-3 text-base text-foreground",
            "placeholder:text-muted-foreground",
            error && "border-destructive",
            !editable && "opacity-50",
            className
          )}
          editable={editable}
          multiline
          numberOfLines={numberOfLines}
          textAlignVertical="top"
          placeholderTextColor="#737373"
          {...props}
        />
        {error && <Text variant="error">{error}</Text>}
      </View>
    );
  }
);

Textarea.displayName = "Textarea";
