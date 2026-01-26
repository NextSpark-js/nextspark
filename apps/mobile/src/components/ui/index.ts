/**
 * UI Components - Barrel Exports
 * shadcn/ui style components for React Native
 */

// Core primitives
export { Text, type TextProps } from "./text";
// Button re-exported from shared package for web/mobile compatibility
export { Button, type ButtonProps } from "@nextsparkjs/ui";
export { Input, type InputProps } from "./input";
export { Textarea, type TextareaProps } from "./textarea";
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
} from "./card";
export {
  Badge,
  PressableBadge,
  type BadgeProps,
  type PressableBadgeProps,
} from "./badge";

// Secondary primitives
export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  getInitials,
  type AvatarProps,
  type AvatarImageProps,
  type AvatarFallbackProps,
} from "./avatar";
export { Separator, type SeparatorProps } from "./separator";
export { Switch, type SwitchProps } from "./switch";
export { Checkbox, type CheckboxProps } from "./checkbox";
export { Select, type SelectProps, type SelectOption } from "./select";
export {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  DialogClose,
  type DialogProps,
  type DialogHeaderProps,
  type DialogTitleProps,
  type DialogDescriptionProps,
  type DialogContentProps,
  type DialogFooterProps,
  type DialogCloseProps,
} from "./dialog";
export {
  Skeleton,
  SkeletonText,
  SkeletonTitle,
  SkeletonAvatar,
  SkeletonCard,
  type SkeletonProps,
} from "./skeleton";
