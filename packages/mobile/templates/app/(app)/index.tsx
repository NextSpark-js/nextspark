/**
 * Home Screen (Dashboard)
 */

import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuth, Alert } from '@nextsparkjs/mobile'

export default function HomeScreen() {
  const { user, team, logout } = useAuth()

  const handleLogout = async () => {
    const confirmed = await Alert.confirmDestructive(
      'Sign Out',
      'Are you sure you want to sign out?',
      'Sign Out'
    )

    if (confirmed) {
      await logout()
      router.replace('/login')
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        {/* Welcome Section */}
        <View style={styles.welcome}>
          <Text style={styles.greeting}>Welcome back!</Text>
          <Text style={styles.userName}>{user?.name || user?.email}</Text>
          {team && (
            <Text style={styles.teamName}>Team: {team.name}</Text>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => router.push('/(app)/tasks')}
          >
            <Text style={styles.actionText}>View Tasks</Text>
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={() => router.push('/(app)/task/create')}
          >
            <Text style={styles.actionText}>Create Task</Text>
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={() => router.push('/(app)/settings')}
          >
            <Text style={styles.actionText}>Settings</Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={[styles.actionText, styles.logoutText]}>Sign Out</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  welcome: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  greeting: {
    fontSize: 14,
    color: '#6B7280',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  teamName: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    marginTop: 12,
  },
  logoutText: {
    color: '#DC2626',
  },
})
