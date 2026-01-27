/**
 * Root Layout - Sets up providers
 */

import "./globals.css";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryProvider, AuthProvider } from "@nextsparkjs/mobile";
import { ThemeProvider } from "@nextsparkjs/ui";

/**
 * Custom colors - Override any color from ThemeColors
 * Uncomment and modify to customize your app's theme.
 */
const customColors = {
  // Primary: Dark neutral
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

/**
 * Error Boundary - Catches JavaScript errors in child components
 */
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to your error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <Pressable style={styles.retryButton} onPress={this.handleRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fafafa",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#171717",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#737373",
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#171717",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fafafa",
    fontSize: 14,
    fontWeight: "500",
  },
});

export default function RootLayout() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
