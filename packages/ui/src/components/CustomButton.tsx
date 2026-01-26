import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import {
  buttonVariantConfig,
  type ButtonVariant,
  type ButtonSize,
} from "../variants/button";

// Build CVA from shared config (web version - single className)
const customButtonVariants = cva(
  `inline-flex ${buttonVariantConfig.base} transition-all disabled:pointer-events-none disabled:opacity-50`,
  {
    variants: {
      variant: Object.fromEntries(
        Object.entries(buttonVariantConfig.variants.variant).map(([k, v]) => [
          k,
          v.container,
        ])
      ) as Record<ButtonVariant, string>,
      size: Object.fromEntries(
        Object.entries(buttonVariantConfig.variants.size).map(([k, v]) => [
          k,
          v.container,
        ])
      ) as Record<ButtonSize, string>,
    },
    defaultVariants: buttonVariantConfig.defaultVariants,
  }
);

export interface CustomButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof customButtonVariants> {
  asChild?: boolean;
}

export function CustomButton({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: CustomButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-cy="custom-button"
      className={customButtonVariants({ variant, size, className })}
      {...props}
    />
  );
}
