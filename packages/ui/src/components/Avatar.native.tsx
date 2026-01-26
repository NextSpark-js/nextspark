/**
 * Avatar Component - React Native version
 * User avatar with fallback using StyleSheet
 */
import React, { useState, useMemo } from "react";
import {
  View,
  Image,
  Text,
  StyleSheet,
  type ViewProps,
  type ImageProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { useTheme } from "../native/ThemeContext";

export type AvatarSize = "sm" | "default" | "lg" | "xl";

const sizeStyles: Record<AvatarSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { width: 32, height: 32 },
    text: { fontSize: 12 },
  },
  default: {
    container: { width: 40, height: 40 },
    text: { fontSize: 14 },
  },
  lg: {
    container: { width: 48, height: 48 },
    text: { fontSize: 16 },
  },
  xl: {
    container: { width: 64, height: 64 },
    text: { fontSize: 18 },
  },
};

export interface AvatarProps extends ViewProps {
  size?: AvatarSize;
  // API compatibility props
  className?: string;
}

export const Avatar = React.forwardRef<View, AvatarProps>(
  (
    {
      size = "default",
      children,
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    return (
      <View
        ref={ref}
        style={[styles.avatar, sizeStyles[size].container, style as ViewStyle]}
        {...props}
      >
        {children}
      </View>
    );
  }
);

Avatar.displayName = "Avatar";

// Avatar Image
export interface AvatarImageProps extends Omit<ImageProps, "source" | "src"> {
  src?: string | null;
  // API compatibility props
  className?: string;
}

export const AvatarImage = React.forwardRef<Image, AvatarImageProps>(
  (
    {
      src,
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const [hasError, setHasError] = useState(false);

    if (!src || hasError) return null;

    return (
      <Image
        ref={ref}
        source={{ uri: src }}
        style={[styles.image, style]}
        onError={() => setHasError(true)}
        {...props}
      />
    );
  }
);

AvatarImage.displayName = "AvatarImage";

// Avatar Fallback
export interface AvatarFallbackProps extends ViewProps {
  size?: AvatarSize;
  // API compatibility props
  className?: string;
}

export const AvatarFallback = React.forwardRef<View, AvatarFallbackProps>(
  (
    {
      size = "default",
      children,
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const colorStyles = useMemo(
      () => ({
        fallback: { backgroundColor: colors.accent } as ViewStyle,
        fallbackText: { color: colors.accentForeground } as TextStyle,
      }),
      [colors]
    );

    return (
      <View ref={ref} style={[styles.fallback, colorStyles.fallback, style as ViewStyle]} {...props}>
        {typeof children === "string" ? (
          <Text style={[styles.fallbackText, colorStyles.fallbackText, sizeStyles[size].text]}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    );
  }
);

AvatarFallback.displayName = "AvatarFallback";

// Convenience function to get initials
export function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 9999,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    fontWeight: "600",
  },
});
