/**
 * Root Layout - Sets up providers
 */

import "../src/styles/globals.css";

import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryProvider } from '@/src/providers/QueryProvider'
import { AuthProvider } from '@/src/providers/AuthProvider'

export default function RootLayout() {
  return (
    <QueryProvider>
      <AuthProvider>
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
      </AuthProvider>
    </QueryProvider>
  )
}
