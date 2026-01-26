// Web exports

// Buttons
export { Button, buttonVariants, type ButtonProps } from "./components/Button";

// Form inputs
export { Input, type InputProps } from "./components/Input";
export { Textarea, type TextareaProps } from "./components/Textarea";
export { Checkbox, type CheckboxProps } from "./components/Checkbox";
export { Switch, type SwitchProps } from "./components/Switch";
export { Select, type SelectProps, type SelectOption } from "./components/Select";
export { Label, type LabelProps } from "./components/Label";

// Display
export { Badge, badgeVariants, type BadgeProps } from "./components/Badge";
export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  getInitials,
  avatarVariants,
  type AvatarProps,
  type AvatarImageProps,
  type AvatarFallbackProps,
  type AvatarSize,
} from "./components/Avatar";
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
} from "./components/Card";
export { Separator, type SeparatorProps } from "./components/Separator";
export {
  Skeleton,
  SkeletonText,
  SkeletonTitle,
  SkeletonAvatar,
  SkeletonCard,
  type SkeletonProps,
} from "./components/Skeleton";

// Overlays
export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
  type DialogProps,
  type DialogContentProps,
  type DialogHeaderProps,
  type DialogTitleProps,
  type DialogDescriptionProps,
  type DialogBodyProps,
  type DialogFooterProps,
  type DialogCloseProps,
} from "./components/Dialog";

// Utils
export { cn } from "./utils";
