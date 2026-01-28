/**
 * UI Components - Barrel Exports
 * Re-export ALL from shared @nextsparkjs/ui package
 */

// Core primitives - Mobile specific (uses NativeWind locally)
export { Text, type TextProps } from "./text";

// Theme system
export {
  ThemeProvider,
  useTheme,
  defaultColors,
  type ThemeProviderProps,
  type ThemeColors,
} from "@nextsparkjs/ui";

// Re-exported from shared package for web/mobile compatibility
export { Button, type ButtonProps, buttonVariants } from "@nextsparkjs/ui";
export { Input, type InputProps } from "@nextsparkjs/ui";
export { Textarea, type TextareaProps } from "@nextsparkjs/ui";

// Display components
export {
  Badge,
  PressableBadge,
  type BadgeProps,
  type PressableBadgeProps,
  type BadgeVariant,
} from "@nextsparkjs/ui";
export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  getInitials,
  type AvatarProps,
  type AvatarImageProps,
  type AvatarFallbackProps,
  type AvatarSize,
} from "@nextsparkjs/ui";
export {
  Card,
  PressableCard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardProps,
  type PressableCardProps,
  type CardHeaderProps,
  type CardTitleProps,
  type CardDescriptionProps,
  type CardContentProps,
  type CardFooterProps,
} from "@nextsparkjs/ui";
export { Separator, type SeparatorProps } from "@nextsparkjs/ui";
export {
  Skeleton,
  SkeletonText,
  SkeletonTitle,
  SkeletonAvatar,
  SkeletonCard,
  type SkeletonProps,
} from "@nextsparkjs/ui";

// Form components
export { Checkbox, type CheckboxProps } from "@nextsparkjs/ui";
export { Switch, type SwitchProps } from "@nextsparkjs/ui";
export { Select, type SelectProps, type SelectOption } from "@nextsparkjs/ui";
export { Label, type LabelProps } from "@nextsparkjs/ui";

// Overlay components
export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  type DialogProps,
  type DialogContentProps,
  type DialogHeaderProps,
  type DialogTitleProps,
  type DialogDescriptionProps,
  type DialogFooterProps,
  type DialogCloseProps,
} from "@nextsparkjs/ui";
