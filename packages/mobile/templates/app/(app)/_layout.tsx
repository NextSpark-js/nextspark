/**
 * App Layout - Authenticated screens
 */

import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { Stack, router } from 'expo-router'
import { useAuth } from '@nextsparkjs/mobile'

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading])

  if (isLoading || !isAuthenticated) {
    return null
  }

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#111827',
          contentStyle: { backgroundColor: '#F9FAFB' },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerTitle: 'Home',
          }}
        />
        <Stack.Screen
          name="tasks"
          options={{
            headerTitle: 'Tasks',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerTitle: 'Settings',
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            headerTitle: 'Profile',
          }}
        />
        <Stack.Screen
          name="task/create"
          options={{
            presentation: 'modal',
            headerTitle: 'New Task',
          }}
        />
        <Stack.Screen
          name="task/[id]"
          options={{
            headerTitle: 'Edit Task',
          }}
        />
      </Stack>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
})
