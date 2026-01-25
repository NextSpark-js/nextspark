/**
 * Select Component - Dropdown select with modal
 * Following shadcn/ui patterns for React Native
 */

import { useState } from "react";
import {
  View,
  Pressable,
  Modal,
  FlatList,
  type ViewProps,
} from "react-native";
import { cn } from "@/src/lib/utils";
import { Text } from "./text";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends ViewProps {
  className?: string;
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export function Select({
  className,
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  label,
  error,
  required,
  disabled,
  ...props
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <View className={cn("gap-2", className)} {...props}>
      {label && (
        <Text variant="label">
          {label}
          {required && <Text className="text-destructive"> *</Text>}
        </Text>
      )}

      <Pressable
        className={cn(
          "h-11 flex-row items-center justify-between rounded-lg border border-input bg-card px-3",
          error && "border-destructive",
          disabled && "opacity-50"
        )}
        onPress={() => !disabled && setIsOpen(true)}
      >
        <Text
          className={cn(
            selectedOption ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {selectedOption?.label || placeholder}
        </Text>
        <Text className="text-muted-foreground">▼</Text>
      </Pressable>

      {error && <Text variant="error">{error}</Text>}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50"
          onPress={() => setIsOpen(false)}
        >
          <View className="m-4 max-h-[60%] w-[90%] rounded-xl bg-card">
            <View className="border-b border-border p-4">
              <Text variant="subheading">
                {label || "Select an option"}
              </Text>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  className={cn(
                    "border-b border-border p-4",
                    value === item.value && "bg-secondary"
                  )}
                  onPress={() => {
                    onValueChange?.(item.value);
                    setIsOpen(false);
                  }}
                >
                  <Text
                    className={cn(
                      value === item.value && "font-semibold"
                    )}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
