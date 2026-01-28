/**
 * Checkbox Component - React Native version
 * Custom checkbox using Pressable with StyleSheet
 */
import React, { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { useTheme } from "../native/ThemeContext";

export interface CheckboxProps extends Omit<PressableProps, "onPress"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  textStyle?: TextStyle;
  // API compatibility props
  className?: string;
}

export const Checkbox = React.forwardRef<View, CheckboxProps>(
  (
    {
      checked = false,
      onCheckedChange,
      disabled,
      label,
      style,
      textStyle,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const colorStyles = useMemo(
      () => ({
        checkboxChecked: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        } as ViewStyle,
        checkboxUnchecked: {
          backgroundColor: colors.background,
          borderColor: colors.input,
        } as ViewStyle,
        checkmark: { color: colors.primaryForeground } as TextStyle,
        label: { color: colors.foreground } as TextStyle,
      }),
      [colors]
    );

    return (
      <Pressable
        ref={ref}
        style={[styles.container, disabled && styles.disabled, style as ViewStyle]}
        onPress={() => onCheckedChange?.(!checked)}
        disabled={disabled}
        {...props}
      >
        <View
          style={[
            styles.checkbox,
            checked ? colorStyles.checkboxChecked : colorStyles.checkboxUnchecked,
          ]}
        >
          {checked && <Text style={[styles.checkmark, colorStyles.checkmark]}>✓</Text>}
        </View>
        {label && <Text style={[styles.label, colorStyles.label, textStyle]}>{label}</Text>}
      </Pressable>
    );
  }
);

Checkbox.displayName = "Checkbox";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    borderWidth: 2,
  },
  checkmark: {
    fontSize: 12,
    fontWeight: "bold",
  },
  label: {
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
});
