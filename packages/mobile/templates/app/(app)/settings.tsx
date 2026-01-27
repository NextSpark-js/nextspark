/**
 * Settings Screen
 */

import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth, Alert } from '@nextsparkjs/mobile'
import { router } from 'expo-router'

export default function SettingsScreen() {
  const { user, team, teams, selectTeam, logout } = useAuth()

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
        {/* User Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email}</Text>
          </View>
          {user?.name && (
            <View style={styles.card}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{user.name}</Text>
            </View>
          )}
        </View>

        {/* Team Selection */}
        {teams.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Team</Text>
            {teams.map((t) => (
              <Pressable
                key={t.id}
                style={[
                  styles.card,
                  styles.teamCard,
                  t.id === team?.id && styles.teamCardActive,
                ]}
                onPress={() => selectTeam(t)}
              >
                <Text style={[
                  styles.teamName,
                  t.id === team?.id && styles.teamNameActive,
                ]}>
                  {t.name}
                </Text>
                <Text style={styles.teamRole}>{t.role}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign Out</Text>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  teamCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamCardActive: {
    borderColor: '#171717',
    borderWidth: 2,
  },
  teamName: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  teamNameActive: {
    fontWeight: '700',
  },
  teamRole: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
})
