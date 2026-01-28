/**
 * Theme color types for React Native
 * These define the contract for theming native components
 */
export interface ThemeColors {
  // Base
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;

  // Interactive
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;

  // States
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;

  // Alerts
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;

  // UI
  border: string;
  input: string;
  ring: string;
  placeholder: string;

  // Status colors (optional - app may not use them)
  statusTodo?: string;
  statusInProgress?: string;
  statusReview?: string;
  statusDone?: string;
  statusBlocked?: string;

  // Status text colors
  statusTodoText?: string;
  statusInProgressText?: string;
  statusReviewText?: string;
  statusDoneText?: string;
  statusBlockedText?: string;

  // Dot colors for status badges
  dotTodo?: string;
  dotInProgress?: string;
  dotReview?: string;
  dotDone?: string;
  dotBlocked?: string;
}
