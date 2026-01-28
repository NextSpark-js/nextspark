/**
 * @nextsparkjs/ui - Web exports
 * These components match @nextsparkjs/core implementations exactly
 */

// Theme system (re-export from native for Expo web compatibility)
export { ThemeProvider, useTheme, type ThemeProviderProps } from "./native/ThemeContext";
export { defaultColors } from "./native/defaultColors";
export type { ThemeColors } from "./native/types";

// Buttons
export { Button, buttonVariants, type ButtonProps } from "./components/Button";

// Form inputs
export { Input, type InputProps } from "./components/Input";
export { Textarea, type TextareaProps } from "./components/Textarea";
export { Checkbox, type CheckboxProps } from "./components/Checkbox";
export { Switch, type SwitchProps } from "./components/Switch";
export { Label, type LabelProps } from "./components/Label";

// Display
export { Badge, badgeVariants, type BadgeProps } from "./components/Badge";
export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  getInitials,
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
  SkeletonContainer,
  SkeletonText,
  SkeletonTitle,
  SkeletonAvatar,
  SkeletonCard,
  type SkeletonProps,
  type SkeletonTextProps,
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

// Progress
export { Progress, type ProgressProps } from "./components/Progress";

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
} from "./components/Tabs";

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
} from "./components/Accordion";

// Slider
export { Slider, type SliderProps } from "./components/Slider";

// Utils
export { cn } from "./utils";
