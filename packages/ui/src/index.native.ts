// React Native exports

// Theme system
export { ThemeProvider, useTheme, type ThemeProviderProps } from "./native/ThemeContext";
export { defaultColors } from "./native/defaultColors";
export type { ThemeColors } from "./native/types";

// Buttons
export {
  Button,
  buttonVariants,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
} from "./components/Button.native";

// Form inputs
export { Input, type InputProps } from "./components/Input.native";
export { Textarea, type TextareaProps } from "./components/Textarea.native";
export { Checkbox, type CheckboxProps } from "./components/Checkbox.native";
export { Switch, type SwitchProps } from "./components/Switch.native";
export { Select, type SelectProps, type SelectOption } from "./components/Select.native";
export { Label, type LabelProps } from "./components/Label.native";

// Display
export {
  Badge,
  PressableBadge,
  type BadgeProps,
  type PressableBadgeProps,
  type BadgeVariant,
} from "./components/Badge.native";
export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  getInitials,
  type AvatarProps,
  type AvatarImageProps,
  type AvatarFallbackProps,
  type AvatarSize,
} from "./components/Avatar.native";
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
} from "./components/Card.native";
export { Separator, type SeparatorProps } from "./components/Separator.native";
export {
  Skeleton,
  SkeletonText,
  SkeletonTitle,
  SkeletonAvatar,
  SkeletonCard,
  type SkeletonProps,
} from "./components/Skeleton.native";

// Overlays
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
} from "./components/Dialog.native";

// Progress
export { Progress, type ProgressProps } from "./components/Progress.native";

// Tabs
export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentProps,
} from "./components/Tabs.native";

// Accordion
export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  type AccordionProps,
  type AccordionItemProps,
  type AccordionTriggerProps,
  type AccordionContentProps,
} from "./components/Accordion.native";
