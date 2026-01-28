import React, { useMemo } from "react";
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { useTheme } from "../native/ThemeContext";

export interface InputProps extends Omit<TextInputProps, "style"> {
  label?: string;
  error?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  // API compatibility (ignored in RN - NativeWind doesn't work for external packages)
  className?: string;
  containerClassName?: string;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      required,
      containerStyle,
      inputStyle,
      className,
      containerClassName,
      editable = true,
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const colorStyles = useMemo(
      () => ({
        label: { color: colors.foreground } as TextStyle,
        required: { color: colors.destructive } as TextStyle,
        input: {
          borderColor: colors.border,
          color: colors.foreground,
          backgroundColor: colors.card,
        } as TextStyle,
        inputError: { borderColor: colors.destructive } as TextStyle,
        error: { color: colors.destructive } as TextStyle,
      }),
      [colors]
    );

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <View style={styles.labelRow}>
            <Text style={[styles.label, colorStyles.label]}>{label}</Text>
            {required && <Text style={[styles.required, colorStyles.required]}> *</Text>}
          </View>
        )}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            colorStyles.input,
            error && colorStyles.inputError,
            !editable && styles.inputDisabled,
            inputStyle,
          ]}
          editable={editable}
          placeholderTextColor={colors.placeholder}
          {...props}
        />
        {error && <Text style={[styles.error, colorStyles.error]}>{error}</Text>}
      </View>
    );
  }
);

Input.displayName = "Input";

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
  required: {
    fontSize: 14,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  error: {
    fontSize: 14,
  },
});
