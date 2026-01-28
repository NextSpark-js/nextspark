import React, { useEffect, useRef } from "react";
import {
  View,
  Animated,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../native/ThemeContext";

export interface ProgressProps {
  /** Progress value from 0 to 100 */
  value?: number;
  /** Custom styles for the track */
  style?: ViewStyle;
  /** API compatibility - ignored in native */
  className?: string;
}

const Progress = React.forwardRef<View, ProgressProps>(
  ({ value = 0, style, className }, ref) => {
    const { colors } = useTheme();
    const animatedWidth = useRef(new Animated.Value(value)).current;

    useEffect(() => {
      Animated.timing(animatedWidth, {
        toValue: value,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }, [value, animatedWidth]);

    return (
      <View
        ref={ref}
        style={[
          styles.track,
          { backgroundColor: colors.secondary },
          style,
        ]}
      >
        <Animated.View
          style={[
            styles.indicator,
            {
              backgroundColor: colors.primary,
              width: animatedWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ["0%", "100%"],
                extrapolate: "clamp",
              }),
            },
          ]}
        />
      </View>
    );
  }
);

Progress.displayName = "Progress";

const styles = StyleSheet.create({
  track: {
    height: 16,
    width: "100%",
    overflow: "hidden",
    borderRadius: 9999, // rounded-full
  },
  indicator: {
    height: "100%",
  },
});

export { Progress };
