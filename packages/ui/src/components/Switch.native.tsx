/**
 * Switch Component - React Native version
 * Toggle switch with Reanimated animations
 */
import React, { useEffect, useMemo } from "react";
import {
  Pressable,
  View,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../native/ThemeContext";

export interface SwitchProps extends Omit<PressableProps, "onPress"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  // API compatibility props
  className?: string;
}

// Wrapper to avoid React version type conflicts
const AnimatedThumb = Animated.View as unknown as typeof View;

export const Switch = React.forwardRef<View, SwitchProps>(
  (
    {
      checked = false,
      onCheckedChange,
      disabled,
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();
    const translateX = useSharedValue(checked ? 20 : 0);

    useEffect(() => {
      translateX.value = withTiming(checked ? 20 : 0, { duration: 200 });
    }, [checked, translateX]);

    const thumbStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));

    const colorStyles = useMemo(
      () => ({
        trackChecked: { backgroundColor: colors.primary } as ViewStyle,
        trackUnchecked: { backgroundColor: colors.input } as ViewStyle,
        thumb: { backgroundColor: colors.background } as ViewStyle,
      }),
      [colors]
    );

    return (
      <Pressable
        ref={ref}
        style={[
          styles.track,
          checked ? colorStyles.trackChecked : colorStyles.trackUnchecked,
          disabled && styles.disabled,
          style as ViewStyle,
        ]}
        onPress={() => onCheckedChange?.(!checked)}
        disabled={disabled}
        {...props}
      >
        <AnimatedThumb style={[styles.thumb, colorStyles.thumb, thumbStyle]} />
      </Pressable>
    );
  }
);

Switch.displayName = "Switch";

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: "center",
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});
