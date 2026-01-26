/**
 * Badge Component - React Native version
 * Status and label indicators using StyleSheet
 */
import React, { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewProps,
  type ViewStyle,
  type TextStyle,
  type PressableProps,
} from "react-native";
import { useTheme } from "../native/ThemeContext";
import type { ThemeColors } from "../native/types";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "todo"
  | "in-progress"
  | "review"
  | "done"
  | "blocked"
  | "low"
  | "medium"
  | "high"
  | "urgent";

export interface BadgeProps extends ViewProps {
  variant?: BadgeVariant;
  children?: React.ReactNode;
  showDot?: boolean;
  textStyle?: TextStyle;
  // API compatibility props
  className?: string;
  textClassName?: string;
}

// Helper to get badge variant styles
function getBadgeVariants(colors: ThemeColors) {
  return {
    default: { bg: colors.primary, text: colors.primaryForeground },
    secondary: { bg: colors.secondary, text: colors.secondaryForeground },
    destructive: { bg: colors.destructive, text: colors.destructiveForeground },
    outline: { bg: "transparent", text: colors.foreground, border: colors.border },
    success: { bg: colors.success, text: colors.successForeground },
    // Status variants
    todo: { bg: colors.statusTodo || "rgba(107, 114, 128, 0.2)", text: colors.statusTodoText || "#4b5563" },
    "in-progress": { bg: colors.statusInProgress || "rgba(59, 130, 246, 0.2)", text: colors.statusInProgressText || "#2563eb" },
    review: { bg: colors.statusReview || "rgba(245, 158, 11, 0.2)", text: colors.statusReviewText || "#d97706" },
    done: { bg: colors.statusDone || "rgba(34, 197, 94, 0.2)", text: colors.statusDoneText || "#16a34a" },
    blocked: { bg: colors.statusBlocked || "rgba(239, 68, 68, 0.2)", text: colors.statusBlockedText || "#dc2626" },
    // Priority variants
    low: { bg: colors.statusTodo || "rgba(107, 114, 128, 0.2)", text: colors.statusTodoText || "#4b5563" },
    medium: { bg: colors.statusInProgress || "rgba(59, 130, 246, 0.2)", text: colors.statusInProgressText || "#2563eb" },
    high: { bg: colors.statusReview || "rgba(245, 158, 11, 0.2)", text: colors.statusReviewText || "#d97706" },
    urgent: { bg: colors.statusBlocked || "rgba(239, 68, 68, 0.2)", text: colors.statusBlockedText || "#dc2626" },
  } as const;
}

// Helper to get dot colors
function getDotColors(colors: ThemeColors) {
  return {
    todo: colors.dotTodo || "#6b7280",
    "in-progress": colors.dotInProgress || "#3b82f6",
    review: colors.dotReview || "#f59e0b",
    done: colors.dotDone || "#22c55e",
    blocked: colors.dotBlocked || "#ef4444",
  } as const;
}

export const Badge = React.forwardRef<View, BadgeProps>(
  (
    {
      variant = "default",
      children,
      showDot,
      style,
      textStyle,
      className, // Ignored in RN
      textClassName, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const badgeVariants = useMemo(() => getBadgeVariants(colors), [colors]);
    const badgeDotColors = useMemo(() => getDotColors(colors), [colors]);

    const variantStyle = badgeVariants[variant] || badgeVariants.default;
    const hasBorder = "border" in variantStyle;

    const containerStyle: ViewStyle = {
      backgroundColor: variantStyle.bg,
      ...(hasBorder && {
        borderWidth: 1,
        borderColor: variantStyle.border,
      }),
    };

    const dotColor = showDot && variant && badgeDotColors[variant as keyof typeof badgeDotColors];

    return (
      <View ref={ref} style={[styles.container, containerStyle, style]} {...props}>
        {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
        {typeof children === "string" ? (
          <Text style={[styles.text, { color: variantStyle.text }, textStyle]}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    );
  }
);

Badge.displayName = "Badge";

// Pressable Badge variant
export interface PressableBadgeProps extends Omit<PressableProps, "children"> {
  variant?: BadgeVariant;
  selectedVariant?: BadgeVariant;
  children?: React.ReactNode;
  selected?: boolean;
  textStyle?: TextStyle;
  // API compatibility props
  className?: string;
  textClassName?: string;
}

export const PressableBadge = React.forwardRef<View, PressableBadgeProps>(
  (
    {
      variant = "outline",
      selectedVariant,
      children,
      selected,
      style,
      textStyle,
      className, // Ignored in RN
      textClassName, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();
    const badgeVariants = useMemo(() => getBadgeVariants(colors), [colors]);

    const currentVariant = selected && selectedVariant ? selectedVariant : variant;
    const variantStyle = badgeVariants[currentVariant] || badgeVariants.default;
    const hasBorder = "border" in variantStyle;

    const containerStyle: ViewStyle = {
      backgroundColor: variantStyle.bg,
      ...(hasBorder && {
        borderWidth: selected ? 2 : 1,
        borderColor: variantStyle.border,
      }),
    };

    return (
      <Pressable
        ref={ref}
        style={({ pressed }) => [
          styles.container,
          containerStyle,
          pressed && styles.pressed,
          style as ViewStyle,
        ]}
        {...props}
      >
        {typeof children === "string" ? (
          <Text style={[styles.text, { color: variantStyle.text }, textStyle]}>
            {children}
          </Text>
        ) : (
          children
        )}
      </Pressable>
    );
  }
);

PressableBadge.displayName = "PressableBadge";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: "500",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  pressed: {
    opacity: 0.8,
  },
});
