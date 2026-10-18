/**
 * Card Component - React Native version
 * Compound component for content containers using StyleSheet
 */
import React, { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewProps,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { useTheme } from "../native/ThemeContext";
import type { ViewRef } from "../native/refs";

// Card Root
export interface CardProps extends ViewProps {
  // API compatibility props
  className?: string;
}

export const Card: React.ForwardRefExoticComponent<CardProps & React.RefAttributes<ViewRef>> = React.forwardRef<ViewRef, CardProps>(
  (
    {
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
        card: {
          borderColor: colors.border,
          backgroundColor: colors.card,
        } as ViewStyle,
      }),
      [colors]
    );

    return (
      <View ref={ref} style={[styles.card, colorStyles.card, style as ViewStyle]} {...props}>
        {children}
      </View>
    );
  }
);

Card.displayName = "Card";

// Pressable Card (for clickable cards)
export interface PressableCardProps extends PressableProps {
  children?: React.ReactNode;
  // API compatibility props
  className?: string;
}

export const PressableCard: React.ForwardRefExoticComponent<PressableCardProps & React.RefAttributes<ViewRef>> = React.forwardRef<ViewRef, PressableCardProps>(
  (
    {
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
        card: {
          borderColor: colors.border,
          backgroundColor: colors.card,
        } as ViewStyle,
      }),
      [colors]
    );

    return (
      <Pressable
        ref={ref}
        style={({ pressed }) => [
          styles.card,
          colorStyles.card,
          pressed && styles.pressed,
          style as ViewStyle,
        ]}
        {...props}
      >
        {children}
      </Pressable>
    );
  }
);

PressableCard.displayName = "PressableCard";

// Card Header
export interface CardHeaderProps extends ViewProps {
  // API compatibility props
  className?: string;
}

export const CardHeader: React.ForwardRefExoticComponent<CardHeaderProps & React.RefAttributes<ViewRef>> = React.forwardRef<ViewRef, CardHeaderProps>(
  (
    {
      children,
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    return (
      <View ref={ref} style={[styles.header, style as ViewStyle]} {...props}>
        {children}
      </View>
    );
  }
);

CardHeader.displayName = "CardHeader";

// Card Title
export interface CardTitleProps extends ViewProps {
  children?: React.ReactNode;
  textStyle?: TextStyle;
  // API compatibility props
  className?: string;
}

export const CardTitle: React.ForwardRefExoticComponent<CardTitleProps & React.RefAttributes<ViewRef>> = React.forwardRef<ViewRef, CardTitleProps>(
  (
    {
      children,
      style,
      textStyle,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const colorStyles = useMemo(
      () => ({
        titleText: { color: colors.cardForeground } as TextStyle,
      }),
      [colors]
    );

    return (
      <View ref={ref} style={[style as ViewStyle]} {...props}>
        {typeof children === "string" ? (
          <Text style={[styles.titleText, colorStyles.titleText, textStyle]}>{children}</Text>
        ) : (
          children
        )}
      </View>
    );
  }
);

CardTitle.displayName = "CardTitle";

// Card Description
export interface CardDescriptionProps extends ViewProps {
  children?: React.ReactNode;
  textStyle?: TextStyle;
  // API compatibility props
  className?: string;
}

export const CardDescription: React.ForwardRefExoticComponent<CardDescriptionProps & React.RefAttributes<ViewRef>> = React.forwardRef<ViewRef, CardDescriptionProps>(
  (
    {
      children,
      style,
      textStyle,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const colorStyles = useMemo(
      () => ({
        descriptionText: { color: colors.mutedForeground } as TextStyle,
      }),
      [colors]
    );

    return (
      <View ref={ref} style={[styles.description, style as ViewStyle]} {...props}>
        {typeof children === "string" ? (
          <Text style={[styles.descriptionText, colorStyles.descriptionText, textStyle]}>{children}</Text>
        ) : (
          children
        )}
      </View>
    );
  }
);

CardDescription.displayName = "CardDescription";

// Card Content
export interface CardContentProps extends ViewProps {
  // API compatibility props
  className?: string;
}

export const CardContent: React.ForwardRefExoticComponent<CardContentProps & React.RefAttributes<ViewRef>> = React.forwardRef<ViewRef, CardContentProps>(
  (
    {
      children,
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    return (
      <View ref={ref} style={[style as ViewStyle]} {...props}>
        {children}
      </View>
    );
  }
);

CardContent.displayName = "CardContent";

// Card Footer
export interface CardFooterProps extends ViewProps {
  // API compatibility props
  className?: string;
}

export const CardFooter: React.ForwardRefExoticComponent<CardFooterProps & React.RefAttributes<ViewRef>> = React.forwardRef<ViewRef, CardFooterProps>(
  (
    {
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
        footer: { borderTopColor: colors.border } as ViewStyle,
      }),
      [colors]
    );

    return (
      <View ref={ref} style={[styles.footer, colorStyles.footer, style as ViewStyle]} {...props}>
        {children}
      </View>
    );
  }
);

CardFooter.displayName = "CardFooter";

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  pressed: {
    opacity: 0.8,
  },
  header: {
    marginBottom: 12,
  },
  titleText: {
    fontSize: 18,
    fontWeight: "600",
  },
  description: {
    marginTop: 4,
  },
  descriptionText: {
    fontSize: 14,
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
