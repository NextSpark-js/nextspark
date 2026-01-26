/**
 * Shared button variants - Used by both web and mobile
 * CVA configuration object that defines the design system
 */
export const buttonVariantConfig = {
  base: "items-center justify-center rounded-lg font-semibold",
  variants: {
    variant: {
      primary: { container: "bg-primary", text: "text-primary-foreground" },
      secondary: { container: "bg-secondary", text: "text-secondary-foreground" },
      outline: {
        container: "border border-input bg-background",
        text: "text-foreground",
      },
      ghost: { container: "", text: "text-foreground" },
      destructive: {
        container: "bg-destructive",
        text: "text-destructive-foreground",
      },
    },
    size: {
      sm: { container: "h-9 px-3", text: "text-sm" },
      default: { container: "h-11 px-4", text: "text-base" },
      lg: { container: "h-12 px-6", text: "text-lg" },
    },
  },
  defaultVariants: {
    variant: "primary" as const,
    size: "default" as const,
  },
} as const;

export type ButtonVariant = keyof typeof buttonVariantConfig.variants.variant;
export type ButtonSize = keyof typeof buttonVariantConfig.variants.size;
