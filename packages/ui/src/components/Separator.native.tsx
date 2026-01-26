/**
 * Separator Component - React Native version
 * Divider line using View with StyleSheet
 */
import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../native/ThemeContext";

export interface SeparatorProps extends ViewProps {
  orientation?: "horizontal" | "vertical";
  // API compatibility props
  className?: string;
}

export const Separator = React.forwardRef<View, SeparatorProps>(
  (
    {
      orientation = "horizontal",
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const colorStyles = useMemo(
      () => ({
        base: { backgroundColor: colors.border } as ViewStyle,
      }),
      [colors]
    );

    return (
      <View
        ref={ref}
        style={[
          colorStyles.base,
          orientation === "horizontal" ? styles.horizontal : styles.vertical,
          style as ViewStyle,
        ]}
        {...props}
      />
    );
  }
);

Separator.displayName = "Separator";

const styles = StyleSheet.create({
  horizontal: {
    height: 1,
    width: "100%",
  },
  vertical: {
    width: 1,
    height: "100%",
  },
});
