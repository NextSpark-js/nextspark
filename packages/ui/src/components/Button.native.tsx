import React, { useMemo } from "react";
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { useTheme } from "../native/ThemeContext";

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

export const Button = React.forwardRef<View, ButtonProps>(
  (
    {
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
    },
    ref
  ) => {
    const { colors } = useTheme();
    const isDisabled = disabled || isLoading;

    // Compute variant styles with theme colors
    const variantStyles = useMemo(
      () => ({
        default: {
          container: { backgroundColor: colors.primary } as ViewStyle,
          text: { color: colors.primaryForeground } as TextStyle,
        },
        destructive: {
          container: { backgroundColor: colors.destructive } as ViewStyle,
          text: { color: colors.destructiveForeground } as TextStyle,
        },
        outline: {
          container: {
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.input,
          } as ViewStyle,
          text: { color: colors.foreground } as TextStyle,
        },
        secondary: {
          container: { backgroundColor: colors.secondary } as ViewStyle,
          text: { color: colors.secondaryForeground } as TextStyle,
        },
        ghost: {
          container: { backgroundColor: "transparent" } as ViewStyle,
          text: { color: colors.foreground } as TextStyle,
        },
        link: {
          container: { backgroundColor: "transparent" } as ViewStyle,
          text: { color: colors.primary, textDecorationLine: "underline" } as TextStyle,
        },
        "outline-destructive": {
          container: {
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.destructive,
          } as ViewStyle,
          text: { color: colors.destructive } as TextStyle,
        },
      }),
      [colors]
    );

    const variantStyle = variantStyles[variant] || variantStyles.default;
    const sizeStyle = sizeStyles[size] || sizeStyles.default;

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
        ref={ref}
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
);

Button.displayName = "Button";

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
