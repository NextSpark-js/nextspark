import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";

// NextSpark theme colors (hardcoded for React Native)
// NativeWind doesn't process external packages, so we use StyleSheet
const colors = {
  primary: "#171717",
  primaryForeground: "#fafafa",
  secondary: "#f5f5f5",
  secondaryForeground: "#1a1a1a",
  destructive: "#ef4444",
  destructiveForeground: "#FFFFFF",
  background: "#FFFFFF",
  foreground: "#1a1a1a",
  border: "#e5e5e5",
  input: "#e5e5e5",
  accent: "#f5f5f5",
  accentForeground: "#1a1a1a",
  ring: "#a3a3a3",
};

export type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link"
  | "outline-destructive";

export type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends Omit<PressableProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  isLoading?: boolean;
  // API compatibility props (accepted but may not be used)
  asChild?: boolean;
  className?: string;
  textClassName?: string;
}

export function Button({
  variant = "default",
  size = "default",
  children,
  disabled,
  style,
  textStyle,
  isLoading,
  asChild, // Ignored in RN
  className, // Ignored in RN (NativeWind doesn't work for external packages)
  textClassName, // Ignored in RN
  ...props
}: ButtonProps) {
  const variantStyle = variantStyles[variant] || variantStyles.default;
  const sizeStyle = sizeStyles[size] || sizeStyles.default;
  const isDisabled = disabled || isLoading;

  // Determine spinner color based on variant
  const getSpinnerColor = () => {
    if (
      variant === "outline" ||
      variant === "ghost" ||
      variant === "outline-destructive"
    ) {
      return colors.foreground;
    }
    return colors.primaryForeground;
  };

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyle.container,
        sizeStyle.container,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={getSpinnerColor()} size="small" />
      ) : typeof children === "string" ? (
        <Text
          style={[styles.text, variantStyle.text, sizeStyle.text, textStyle]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

// buttonVariants export for API compatibility with web version
export const buttonVariants = (options: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) => {
  // No-op for RN - styles are applied via StyleSheet
  return "";
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8, // rounded-lg equivalent
    gap: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: "600", // font-semibold
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantStyles: Record<
  ButtonVariant,
  { container: ViewStyle; text: TextStyle }
> = {
  default: {
    container: { backgroundColor: colors.primary },
    text: { color: colors.primaryForeground },
  },
  destructive: {
    container: { backgroundColor: colors.destructive },
    text: { color: colors.destructiveForeground },
  },
  outline: {
    container: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.input,
    },
    text: { color: colors.foreground },
  },
  secondary: {
    container: { backgroundColor: colors.secondary },
    text: { color: colors.secondaryForeground },
  },
  ghost: {
    container: { backgroundColor: "transparent" },
    text: { color: colors.foreground },
  },
  link: {
    container: { backgroundColor: "transparent" },
    text: { color: colors.primary, textDecorationLine: "underline" },
  },
  "outline-destructive": {
    container: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.destructive,
    },
    text: { color: colors.destructive },
  },
};

const sizeStyles: Record<
  ButtonSize,
  { container: ViewStyle; text: TextStyle }
> = {
  default: {
    container: { height: 44, paddingHorizontal: 16 }, // h-11
    text: { fontSize: 16 }, // text-base
  },
  sm: {
    container: { height: 36, paddingHorizontal: 12 }, // h-9
    text: { fontSize: 14 }, // text-sm
  },
  lg: {
    container: { height: 48, paddingHorizontal: 24 }, // h-12
    text: { fontSize: 18 }, // text-lg
  },
  icon: {
    container: { height: 40, width: 40, paddingHorizontal: 0 }, // h-10 w-10
    text: { fontSize: 16 },
  },
};
