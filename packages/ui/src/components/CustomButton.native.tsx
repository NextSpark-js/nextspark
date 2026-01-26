import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import {
  type ButtonVariant,
  type ButtonSize,
} from "../variants/button";

/**
 * Theme colors - matching NextSpark default theme
 * These are hardcoded for React Native compatibility
 * (CSS variables don't work in RN StyleSheet)
 */
const colors = {
  // Primary (black theme)
  primary: "#171717",
  primaryForeground: "#fafafa",
  // Secondary
  secondary: "#f5f5f5",
  secondaryForeground: "#1a1a1a",
  // Outline/Ghost
  background: "#FFFFFF",
  foreground: "#1a1a1a",
  border: "#e5e5e5",
  // Destructive
  destructive: "#ef4444",
  destructiveForeground: "#FFFFFF",
};

export interface CustomButtonProps extends Omit<PressableProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: React.ReactNode;
  isLoading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function CustomButton({
  variant = "primary",
  size = "default",
  children,
  disabled,
  isLoading,
  style,
  textStyle,
  ...props
}: CustomButtonProps) {
  const isDisabled = disabled || isLoading;

  // Get variant styles
  const variantContainerStyle = variantStyles[variant]?.container || {};
  const variantTextStyle = variantStyles[variant]?.text || {};

  // Get size styles
  const sizeContainerStyle = sizeStyles[size]?.container || {};
  const sizeTextStyle = sizeStyles[size]?.text || {};

  return (
    <Pressable
      testID="custom-button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantContainerStyle,
        sizeContainerStyle,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variantTextStyle.color || colors.primaryForeground}
        />
      ) : typeof children === "string" ? (
        <Text style={[styles.text, variantTextStyle, sizeTextStyle, textStyle]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  text: {
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});

// Variant-specific styles
const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: {
      backgroundColor: colors.primary,
    },
    text: {
      color: colors.primaryForeground,
    },
  },
  secondary: {
    container: {
      backgroundColor: colors.secondary,
    },
    text: {
      color: colors.secondaryForeground,
    },
  },
  outline: {
    container: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: {
      color: colors.foreground,
    },
  },
  ghost: {
    container: {
      backgroundColor: "transparent",
    },
    text: {
      color: colors.foreground,
    },
  },
  destructive: {
    container: {
      backgroundColor: colors.destructive,
    },
    text: {
      color: colors.destructiveForeground,
    },
  },
};

// Size-specific styles
const sizeStyles: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: {
      height: 36,
      paddingHorizontal: 12,
    },
    text: {
      fontSize: 14,
    },
  },
  default: {
    container: {
      height: 44,
      paddingHorizontal: 16,
    },
    text: {
      fontSize: 16,
    },
  },
  lg: {
    container: {
      height: 48,
      paddingHorizontal: 24,
    },
    text: {
      fontSize: 18,
    },
  },
};
