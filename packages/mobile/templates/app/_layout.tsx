/**
 * Root Layout - Sets up providers
 */

import "../src/styles/globals.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryProvider, AuthProvider } from "@nextsparkjs/mobile";
import { ThemeProvider } from "@nextsparkjs/ui";

/**
 * Custom colors demo - Override any color from ThemeColors
 * These match the web app's default design system.
 * Uncomment and modify to customize your app's theme.
 */
const customColors = {
  // Primary: Dark neutral (matches web)
  primary: "#171717",
  primaryForeground: "#fafafa",

  // Secondary: Light gray
  secondary: "#f5f5f5",
  secondaryForeground: "#1a1a1a",

  // Destructive: Red for errors/danger
  destructive: "#ef4444",
  destructiveForeground: "#FFFFFF",

  // Success: Green for confirmations
  success: "#22c55e",
  successForeground: "#FFFFFF",
};

export default function RootLayout() {
  return (
    <QueryProvider>
      <AuthProvider>
        <ThemeProvider colors={customColors}>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(app)" />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
