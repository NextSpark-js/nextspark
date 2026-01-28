/**
 * App Layout - NextSpark Mobile Style with Bottom Tab Navigation
 */

import { useEffect, useState, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { Alert } from '@/src/lib/alert'
import { Stack, router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/src/providers/AuthProvider'
import {
  TopBar,
  BottomTabBar,
  MoreSheet,
  CreateSheet,
  type TabKey,
} from '@/src/components/navigation'
import { Colors } from '@/src/constants/colors'
import notificationsData from '@/src/data/notifications.mock.json'

export default function AppLayout() {
  const { isAuthenticated, isLoading, logout } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabKey>('home')
  const [moreSheetVisible, setMoreSheetVisible] = useState(false)
  const [createSheetVisible, setCreateSheetVisible] = useState(false)

  // Calculate unread notifications count from mock data
  const unreadNotificationCount = useMemo(
    () => notificationsData.notifications.filter((n) => !n.read).length,
    []
  )

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading])

  if (isLoading || !isAuthenticated) {
    return null
  }

  const handleTabPress = (tab: TabKey) => {
    if (tab === 'more') {
      setMoreSheetVisible(true)
      return
    }

    if (tab === 'create') {
      setCreateSheetVisible(true)
      return
    }

    setActiveTab(tab)

    // Navigate based on tab
    switch (tab) {
      case 'home':
        router.replace('/(app)' as const)
        break
      case 'tasks':
        router.replace('/(app)/tasks')
        break
      case 'customers':
        router.replace('/(app)/customers')
        break
    }
  }

  const handleMoreNavigate = (screen: string) => {
    switch (screen) {
      case 'profile':
        router.push('/(app)/profile')
        break
      case 'settings':
        router.push('/(app)/settings')
        break
      case 'billing':
        // TODO: Add billing screen
        break
      case 'api-keys':
        // TODO: Add API keys screen
        break
    }
  }

  const handleCreateEntity = (entity: string) => {
    switch (entity) {
      case 'customer':
        router.push('/(app)/customer/create')
        break
      case 'task':
        router.push('/(app)/task/create')
        break
    }
  }

  const handleLogout = async () => {
    setMoreSheetVisible(false)
    const confirmed = await Alert.confirmDestructive(
      'Cerrar Sesión',
      '¿Estás seguro que deseas salir?',
      'Salir'
    )

    if (confirmed) {
      await logout()
      router.replace('/login')
    }
  }

  const handleTeamChange = () => {
    // Invalidate all queries to refresh data for the new team
    queryClient.invalidateQueries()
    // Navigate to home to show refreshed data
    setActiveTab('home')
    router.replace('/(app)' as const)
  }

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <TopBar notificationCount={unreadNotificationCount} />

      {/* Screen Content */}
      <View style={styles.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.backgroundSecondary },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="tasks" />
          <Stack.Screen name="customers" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="profile" />
          <Stack.Screen
            name="notifications"
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="task/create"
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Nueva Tarea',
              headerStyle: { backgroundColor: Colors.background },
              headerTintColor: Colors.foreground,
            }}
          />
          <Stack.Screen
            name="task/[id]"
            options={{
              headerShown: true,
              headerTitle: 'Editar Tarea',
              headerStyle: { backgroundColor: Colors.background },
              headerTintColor: Colors.foreground,
            }}
          />
          <Stack.Screen
            name="customer/create"
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Nuevo Cliente',
              headerStyle: { backgroundColor: Colors.background },
              headerTintColor: Colors.foreground,
            }}
          />
          <Stack.Screen
            name="customer/[id]"
            options={{
              headerShown: true,
              headerTitle: 'Editar Cliente',
              headerStyle: { backgroundColor: Colors.background },
              headerTintColor: Colors.foreground,
            }}
          />
        </Stack>
      </View>

      {/* Bottom Tab Bar */}
      <BottomTabBar activeTab={activeTab} onTabPress={handleTabPress} />

      {/* More Options Sheet */}
      <MoreSheet
        visible={moreSheetVisible}
        onClose={() => setMoreSheetVisible(false)}
        onNavigate={handleMoreNavigate}
        onLogout={handleLogout}
        onTeamChange={handleTeamChange}
      />

      {/* Create Sheet */}
      <CreateSheet
        visible={createSheetVisible}
        onClose={() => setCreateSheetVisible(false)}
        onCreateEntity={handleCreateEntity}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
})
