/**
 * Text Component - Styled text with variants
 * Following shadcn/ui patterns for React Native
 */

import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/src/lib/utils";

const textVariants = cva("text-foreground", {
  variants: {
    variant: {
      default: "",
      heading: "text-2xl font-bold",
      subheading: "text-lg font-semibold",
      body: "text-base",
      small: "text-sm",
      muted: "text-muted-foreground",
      label: "text-sm font-semibold",
      error: "text-destructive text-sm",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface TextProps
  extends RNTextProps,
    VariantProps<typeof textVariants> {
  className?: string;
}

export function Text({
  className,
  variant,
  weight,
  children,
  ...props
}: TextProps) {
  return (
    <RNText
      className={cn(textVariants({ variant, weight }), className)}
      {...props}
    >
      {children}
    </RNText>
  );
}
