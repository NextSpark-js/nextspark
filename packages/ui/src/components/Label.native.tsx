/**
 * Label Component - React Native version
 * Form label using Text with StyleSheet
 */
import React, { useMemo } from "react";
import {
  Text,
  StyleSheet,
  type TextProps,
  type TextStyle,
} from "react-native";
import { useTheme } from "../native/ThemeContext";

export interface LabelProps extends TextProps {
  required?: boolean;
  // API compatibility props
  className?: string;
  htmlFor?: string; // Ignored in RN
}

export const Label = React.forwardRef<Text, LabelProps>(
  (
    {
      children,
      required,
      style,
      className, // Ignored in RN
      htmlFor, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const colorStyles = useMemo(
      () => ({
        label: { color: colors.foreground } as TextStyle,
        required: { color: colors.destructive } as TextStyle,
      }),
      [colors]
    );

    return (
      <Text ref={ref} style={[styles.label, colorStyles.label, style as TextStyle]} {...props}>
        {children}
        {required && <Text style={colorStyles.required}> *</Text>}
      </Text>
    );
  }
);

Label.displayName = "Label";

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 14,
  },
});
