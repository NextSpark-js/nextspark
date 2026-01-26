/**
 * Skeleton Component - React Native version
 * Loading placeholder with Reanimated pulse animation
 */
import React, { useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { useTheme } from "../native/ThemeContext";

export interface SkeletonProps extends ViewProps {
  // API compatibility props
  className?: string;
}

// Wrapper to avoid React version type conflicts
const AnimatedBox = Animated.View as unknown as typeof View;

export const Skeleton = React.forwardRef<View, SkeletonProps>(
  (
    {
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();
    const opacity = useSharedValue(1);

    useEffect(() => {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        false
      );
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
    }));

    const colorStyles = useMemo(
      () => ({
        base: { backgroundColor: colors.muted } as ViewStyle,
      }),
      [colors]
    );

    return (
      <AnimatedBox
        ref={ref}
        style={[styles.base, colorStyles.base, animatedStyle, style as ViewStyle]}
        {...props}
      />
    );
  }
);

Skeleton.displayName = "Skeleton";

// Common skeleton patterns
export const SkeletonText = React.forwardRef<View, SkeletonProps>(
  (
    {
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const colorStyles = useMemo(
      () => ({
        text: { backgroundColor: colors.muted } as ViewStyle,
      }),
      [colors]
    );

    return <Skeleton ref={ref} style={[styles.text, colorStyles.text, style as ViewStyle]} {...props} />;
  }
);

SkeletonText.displayName = "SkeletonText";

export const SkeletonTitle = React.forwardRef<View, SkeletonProps>(
  (
    {
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const colorStyles = useMemo(
      () => ({
        title: { backgroundColor: colors.muted } as ViewStyle,
      }),
      [colors]
    );

    return <Skeleton ref={ref} style={[styles.title, colorStyles.title, style as ViewStyle]} {...props} />;
  }
);

SkeletonTitle.displayName = "SkeletonTitle";

export const SkeletonAvatar = React.forwardRef<View, SkeletonProps>(
  (
    {
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const colorStyles = useMemo(
      () => ({
        avatar: { backgroundColor: colors.muted } as ViewStyle,
      }),
      [colors]
    );

    return <Skeleton ref={ref} style={[styles.avatar, colorStyles.avatar, style as ViewStyle]} {...props} />;
  }
);

SkeletonAvatar.displayName = "SkeletonAvatar";

export const SkeletonCard = React.forwardRef<View, SkeletonProps>(
  (
    {
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const colorStyles = useMemo(
      () => ({
        card: {
          borderColor: colors.border,
          backgroundColor: colors.card,
        } as ViewStyle,
        skeleton: { backgroundColor: colors.muted } as ViewStyle,
      }),
      [colors]
    );

    return (
      <View ref={ref} style={[styles.card, colorStyles.card, style as ViewStyle]} {...props}>
        <Skeleton style={[styles.cardTitle, colorStyles.skeleton]} />
        <Skeleton style={[styles.cardLine1, colorStyles.skeleton]} />
        <Skeleton style={[styles.cardLine2, colorStyles.skeleton]} />
        <View style={styles.cardBadges}>
          <Skeleton style={[styles.cardBadge, colorStyles.skeleton]} />
          <Skeleton style={[styles.cardBadge, colorStyles.skeleton]} />
        </View>
      </View>
    );
  }
);

SkeletonCard.displayName = "SkeletonCard";

const styles = StyleSheet.create({
  base: {
    borderRadius: 6,
  },
  text: {
    height: 16,
    width: "75%",
    borderRadius: 6,
  },
  title: {
    height: 24,
    width: "50%",
    borderRadius: 6,
  },
  avatar: {
    height: 40,
    width: 40,
    borderRadius: 20,
  },
  card: {
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: {
    height: 20,
    width: "66%",
    borderRadius: 6,
  },
  cardLine1: {
    height: 16,
    width: "100%",
    borderRadius: 6,
  },
  cardLine2: {
    height: 16,
    width: "80%",
    borderRadius: 6,
  },
  cardBadges: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 8,
  },
  cardBadge: {
    height: 24,
    width: 64,
    borderRadius: 12,
  },
});
