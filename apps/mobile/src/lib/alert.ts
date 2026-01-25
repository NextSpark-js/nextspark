/**
 * Cross-platform Alert utility
 * Works on iOS, Android, and Web
 */

import { Alert as RNAlert, Platform } from "react-native";

interface AlertButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

interface AlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

/**
 * Show an alert dialog that works on all platforms
 */
export function alert(options: AlertOptions): void {
  const { title, message, buttons = [{ text: "OK" }] } = options;

  if (Platform.OS === "web") {
    // Web: use window.confirm for simple confirm dialogs
    const hasDestructive = buttons.some((b) => b.style === "destructive");
    const hasCancel = buttons.some((b) => b.style === "cancel");

    if (hasDestructive && hasCancel) {
      // Confirmation dialog
      const confirmed = window.confirm(`${title}\n\n${message || ""}`);
      if (confirmed) {
        const destructiveBtn = buttons.find((b) => b.style === "destructive");
        destructiveBtn?.onPress?.();
      } else {
        const cancelBtn = buttons.find((b) => b.style === "cancel");
        cancelBtn?.onPress?.();
      }
    } else if (buttons.length === 1) {
      // Simple alert
      window.alert(`${title}\n\n${message || ""}`);
      buttons[0]?.onPress?.();
    } else {
      // For more complex cases, use confirm
      const confirmed = window.confirm(`${title}\n\n${message || ""}`);
      const btn = confirmed ? buttons[buttons.length - 1] : buttons[0];
      btn?.onPress?.();
    }
  } else {
    // Native: use React Native Alert
    RNAlert.alert(title, message, buttons);
  }
}

/**
 * Show a confirmation dialog
 * Returns a promise that resolves to true if confirmed, false if cancelled
 */
export function confirm(title: string, message?: string): Promise<boolean> {
  return new Promise((resolve) => {
    alert({
      title,
      message,
      buttons: [
        { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
        { text: "Confirmar", style: "default", onPress: () => resolve(true) },
      ],
    });
  });
}

/**
 * Show a destructive confirmation dialog (for delete actions)
 */
export function confirmDestructive(
  title: string,
  message?: string,
  destructiveButtonText = "Eliminar"
): Promise<boolean> {
  return new Promise((resolve) => {
    alert({
      title,
      message,
      buttons: [
        { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
        {
          text: destructiveButtonText,
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
    });
  });
}

export const Alert = {
  alert,
  confirm,
  confirmDestructive,
};
