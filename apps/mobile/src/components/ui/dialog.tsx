/**
 * Dialog Component - Modal dialog
 * Following shadcn/ui patterns for React Native
 */

import {
  View,
  Modal,
  Pressable,
  type ModalProps,
  type ViewProps,
} from "react-native";
import { cn } from "@/src/lib/utils";
import { Text } from "./text";

// Dialog Context
export interface DialogProps extends Omit<ModalProps, "visible"> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function Dialog({
  open = false,
  onOpenChange,
  children,
  ...props
}: DialogProps) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange?.(false)}
      {...props}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/50 p-4"
        onPress={() => onOpenChange?.(false)}
      >
        <Pressable
          className="w-full max-w-lg rounded-xl bg-card"
          onPress={(e) => e.stopPropagation()}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Dialog Header
export interface DialogHeaderProps extends ViewProps {
  className?: string;
}

export function DialogHeader({
  className,
  children,
  ...props
}: DialogHeaderProps) {
  return (
    <View className={cn("border-b border-border p-4", className)} {...props}>
      {children}
    </View>
  );
}

// Dialog Title
export interface DialogTitleProps extends ViewProps {
  className?: string;
  children?: React.ReactNode;
}

export function DialogTitle({
  className,
  children,
  ...props
}: DialogTitleProps) {
  return (
    <View className={cn("", className)} {...props}>
      {typeof children === "string" ? (
        <Text variant="subheading">{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

// Dialog Description
export interface DialogDescriptionProps extends ViewProps {
  className?: string;
  children?: React.ReactNode;
}

export function DialogDescription({
  className,
  children,
  ...props
}: DialogDescriptionProps) {
  return (
    <View className={cn("mt-1", className)} {...props}>
      {typeof children === "string" ? (
        <Text variant="muted">{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

// Dialog Content
export interface DialogContentProps extends ViewProps {
  className?: string;
}

export function DialogContent({
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <View className={cn("p-4", className)} {...props}>
      {children}
    </View>
  );
}

// Dialog Footer
export interface DialogFooterProps extends ViewProps {
  className?: string;
}

export function DialogFooter({
  className,
  children,
  ...props
}: DialogFooterProps) {
  return (
    <View
      className={cn(
        "flex-row justify-end gap-2 border-t border-border p-4",
        className
      )}
      {...props}
    >
      {children}
    </View>
  );
}

// Dialog Close (trigger to close)
export interface DialogCloseProps {
  className?: string;
  children?: React.ReactNode;
  onClose?: () => void;
}

export function DialogClose({ children, onClose }: DialogCloseProps) {
  return (
    <Pressable onPress={onClose}>
      {children}
    </Pressable>
  );
}
