/**
 * Select Component - React Native version
 * Dropdown select using Modal + FlatList
 */
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  type ViewProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { useTheme } from "../native/ThemeContext";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends ViewProps {
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  // API compatibility props
  className?: string;
}

export const Select = React.forwardRef<View, SelectProps>(
  (
    {
      options,
      value,
      onValueChange,
      placeholder = "Select...",
      label,
      error,
      required,
      disabled,
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    const selectedOption = options.find((opt) => opt.value === value);

    const colorStyles = useMemo(
      () => ({
        label: { color: colors.foreground } as TextStyle,
        required: { color: colors.destructive } as TextStyle,
        trigger: {
          borderColor: colors.input,
          backgroundColor: colors.card,
        } as ViewStyle,
        triggerError: { borderColor: colors.destructive } as ViewStyle,
        triggerText: { color: colors.foreground } as TextStyle,
        placeholder: { color: colors.mutedForeground } as TextStyle,
        chevron: { color: colors.mutedForeground } as TextStyle,
        error: { color: colors.destructive } as TextStyle,
        modalContent: { backgroundColor: colors.card } as ViewStyle,
        modalHeader: { borderBottomColor: colors.border } as ViewStyle,
        modalTitle: { color: colors.cardForeground } as TextStyle,
        option: { borderBottomColor: colors.border } as ViewStyle,
        optionSelected: { backgroundColor: colors.secondary } as ViewStyle,
        optionText: { color: colors.foreground } as TextStyle,
      }),
      [colors]
    );

    return (
      <View ref={ref} style={[styles.container, style as ViewStyle]} {...props}>
        {label && (
          <Text style={[styles.label, colorStyles.label]}>
            {label}
            {required && <Text style={colorStyles.required}> *</Text>}
          </Text>
        )}

        <Pressable
          style={[
            styles.trigger,
            colorStyles.trigger,
            error && colorStyles.triggerError,
            disabled && styles.disabled,
          ]}
          onPress={() => !disabled && setIsOpen(true)}
        >
          <Text
            style={[
              styles.triggerText,
              colorStyles.triggerText,
              !selectedOption && colorStyles.placeholder,
            ]}
          >
            {selectedOption?.label || placeholder}
          </Text>
          <Text style={[styles.chevron, colorStyles.chevron]}>▼</Text>
        </Pressable>

        {error && <Text style={[styles.error, colorStyles.error]}>{error}</Text>}

        <Modal
          visible={isOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsOpen(false)}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setIsOpen(false)}
          >
            <View style={[styles.modalContent, colorStyles.modalContent]}>
              <View style={[styles.modalHeader, colorStyles.modalHeader]}>
                <Text style={[styles.modalTitle, colorStyles.modalTitle]}>
                  {label || "Select an option"}
                </Text>
              </View>
              <FlatList
                data={options}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.option,
                      colorStyles.option,
                      value === item.value && colorStyles.optionSelected,
                    ]}
                    onPress={() => {
                      onValueChange?.(item.value);
                      setIsOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        colorStyles.optionText,
                        value === item.value && styles.optionTextSelected,
                      ]}
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
);

Select.displayName = "Select";

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  trigger: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  triggerText: {
    fontSize: 14,
  },
  chevron: {
    fontSize: 10,
  },
  error: {
    fontSize: 12,
  },
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    margin: 16,
    maxHeight: "60%",
    width: "90%",
    borderRadius: 12,
    overflow: "hidden",
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  option: {
    padding: 16,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 14,
  },
  optionTextSelected: {
    fontWeight: "600",
  },
});
