/**
 * Separator Component - Divider line
 * Following shadcn/ui patterns for React Native
 */

import { View, type ViewProps } from "react-native";
import { cn } from "@/src/lib/utils";

export interface SeparatorProps extends ViewProps {
  className?: string;
  orientation?: "horizontal" | "vertical";
}

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorProps) {
  return (
    <View
      className={cn(
        "bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
      {...props}
    />
  );
}
