import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";

// NextSpark theme colors (hardcoded for React Native)
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
  | "link";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends Omit<PressableProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  asChild?: boolean; // Not used in RN but added for API compatibility
  className?: string; // Not used in RN but added for API compatibility
}

export function Button({
  variant = "default",
  size = "default",
  children,
  disabled,
  style,
  textStyle,
  asChild, // Ignored in RN
  className, // Ignored in RN
  ...props
}: ButtonProps) {
  const variantStyle = variantStyles[variant] || variantStyles.default;
  const sizeStyle = sizeStyles[size] || sizeStyles.default;

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variantStyle.container,
        sizeStyle.container,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {typeof children === "string" ? (
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
    borderRadius: 6,
    gap: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
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
      borderColor: colors.border,
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
};

const sizeStyles: Record<
  ButtonSize,
  { container: ViewStyle; text: TextStyle }
> = {
  default: {
    container: { height: 36, paddingHorizontal: 16, paddingVertical: 8 },
    text: { fontSize: 14 },
  },
  sm: {
    container: { height: 32, paddingHorizontal: 12 },
    text: { fontSize: 14 },
  },
  lg: {
    container: { height: 40, paddingHorizontal: 24 },
    text: { fontSize: 14 },
  },
  icon: {
    container: { height: 36, width: 36, paddingHorizontal: 0 },
    text: {},
  },
};
