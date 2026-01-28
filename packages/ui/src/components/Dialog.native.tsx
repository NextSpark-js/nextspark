/**
 * Dialog Component - React Native version
 * Modal dialog using RN Modal component
 */
import React, { useMemo } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  type ModalProps,
  type ViewProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { useTheme } from "../native/ThemeContext";

// Dialog Root
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
  const { colors } = useTheme();

  const colorStyles = useMemo(
    () => ({
      content: { backgroundColor: colors.card } as ViewStyle,
    }),
    [colors]
  );

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange?.(false)}
      {...props}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => onOpenChange?.(false)}
      >
        <Pressable
          style={[styles.content, colorStyles.content]}
          onPress={(e) => e.stopPropagation()}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

Dialog.displayName = "Dialog";

// Dialog Header
export interface DialogHeaderProps extends ViewProps {
  // API compatibility props
  className?: string;
}

export const DialogHeader = React.forwardRef<View, DialogHeaderProps>(
  (
    {
      children,
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const colorStyles = useMemo(
      () => ({
        header: { borderBottomColor: colors.border } as ViewStyle,
      }),
      [colors]
    );

    return (
      <View ref={ref} style={[styles.header, colorStyles.header, style as ViewStyle]} {...props}>
        {children}
      </View>
    );
  }
);

DialogHeader.displayName = "DialogHeader";

// Dialog Title
export interface DialogTitleProps extends ViewProps {
  children?: React.ReactNode;
  textStyle?: TextStyle;
  // API compatibility props
  className?: string;
}

export const DialogTitle = React.forwardRef<View, DialogTitleProps>(
  (
    {
      children,
      style,
      textStyle,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const colorStyles = useMemo(
      () => ({
        titleText: { color: colors.cardForeground } as TextStyle,
      }),
      [colors]
    );

    return (
      <View ref={ref} style={[style as ViewStyle]} {...props}>
        {typeof children === "string" ? (
          <Text style={[styles.titleText, colorStyles.titleText, textStyle]}>{children}</Text>
        ) : (
          children
        )}
      </View>
    );
  }
);

DialogTitle.displayName = "DialogTitle";

// Dialog Description
export interface DialogDescriptionProps extends ViewProps {
  children?: React.ReactNode;
  textStyle?: TextStyle;
  // API compatibility props
  className?: string;
}

export const DialogDescription = React.forwardRef<View, DialogDescriptionProps>(
  (
    {
      children,
      style,
      textStyle,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const colorStyles = useMemo(
      () => ({
        descriptionText: { color: colors.mutedForeground } as TextStyle,
      }),
      [colors]
    );

    return (
      <View ref={ref} style={[styles.description, style as ViewStyle]} {...props}>
        {typeof children === "string" ? (
          <Text style={[styles.descriptionText, colorStyles.descriptionText, textStyle]}>{children}</Text>
        ) : (
          children
        )}
      </View>
    );
  }
);

DialogDescription.displayName = "DialogDescription";

// Dialog Body/Content area
export interface DialogContentProps extends ViewProps {
  // API compatibility props
  className?: string;
}

export const DialogContent = React.forwardRef<View, DialogContentProps>(
  (
    {
      children,
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    return (
      <View ref={ref} style={[styles.body, style as ViewStyle]} {...props}>
        {children}
      </View>
    );
  }
);

DialogContent.displayName = "DialogContent";

// Dialog Footer
export interface DialogFooterProps extends ViewProps {
  // API compatibility props
  className?: string;
}

export const DialogFooter = React.forwardRef<View, DialogFooterProps>(
  (
    {
      children,
      style,
      className, // Ignored in RN
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const colorStyles = useMemo(
      () => ({
        footer: { borderTopColor: colors.border } as ViewStyle,
      }),
      [colors]
    );

    return (
      <View ref={ref} style={[styles.footer, colorStyles.footer, style as ViewStyle]} {...props}>
        {children}
      </View>
    );
  }
);

DialogFooter.displayName = "DialogFooter";

// Dialog Close (trigger to close)
export interface DialogCloseProps {
  children?: React.ReactNode;
  onClose?: () => void;
  // API compatibility props
  className?: string;
}

export const DialogClose = React.forwardRef<View, DialogCloseProps>(
  (
    {
      children,
      onClose,
      className, // Ignored in RN
    },
    ref
  ) => {
    return (
      <Pressable ref={ref} onPress={onClose}>
        {children}
      </Pressable>
    );
  }
);

DialogClose.displayName = "DialogClose";

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 16,
  },
  content: {
    width: "100%",
    maxWidth: 512,
    borderRadius: 12,
    maxHeight: "85%",
    overflow: "hidden",
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  titleText: {
    fontSize: 18,
    fontWeight: "600",
  },
  description: {
    marginTop: 4,
  },
  descriptionText: {
    fontSize: 14,
  },
  body: {
    padding: 16,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
  },
});
