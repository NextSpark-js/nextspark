/**
 * Default colors for React Native components
 * These are used when no ThemeProvider is present or as fallback values
 */
import type { ThemeColors } from "./types";

export const defaultColors: ThemeColors = {
  // Base
  background: "#FFFFFF",
  foreground: "#1a1a1a",
  card: "#FFFFFF",
  cardForeground: "#1a1a1a",

  // Interactive
  primary: "#171717",
  primaryForeground: "#fafafa",
  secondary: "#f5f5f5",
  secondaryForeground: "#1a1a1a",

  // States
  muted: "#f5f5f5",
  mutedForeground: "#737373",
  accent: "#f5f5f5",
  accentForeground: "#1a1a1a",

  // Alerts
  destructive: "#ef4444",
  destructiveForeground: "#FFFFFF",
  success: "#22c55e",
  successForeground: "#FFFFFF",

  // UI
  border: "#e5e5e5",
  input: "#e5e5e5",
  ring: "#a3a3a3",
  placeholder: "#a3a3a3",

  // Status colors
  statusTodo: "rgba(107, 114, 128, 0.2)", // gray-500/20
  statusInProgress: "rgba(59, 130, 246, 0.2)", // blue-500/20
  statusReview: "rgba(245, 158, 11, 0.2)", // amber-500/20
  statusDone: "rgba(34, 197, 94, 0.2)", // green-500/20
  statusBlocked: "rgba(239, 68, 68, 0.2)", // red-500/20

  // Status text colors
  statusTodoText: "#4b5563", // gray-600
  statusInProgressText: "#2563eb", // blue-600
  statusReviewText: "#d97706", // amber-600
  statusDoneText: "#16a34a", // green-600
  statusBlockedText: "#dc2626", // red-600

  // Dot colors
  dotTodo: "#6b7280", // gray-500
  dotInProgress: "#3b82f6", // blue-500
  dotReview: "#f59e0b", // amber-500
  dotDone: "#22c55e", // green-500
  dotBlocked: "#ef4444", // red-500
};
