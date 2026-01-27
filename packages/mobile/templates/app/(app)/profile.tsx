/**
 * Profile Screen
 */

import { View, Text, StyleSheet, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@nextsparkjs/mobile'

export default function ProfileScreen() {
  const { user, team } = useAuth()

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email?.substring(0, 2).toUpperCase() || '??'
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          {user?.image ? (
            <Image source={{ uri: user.image }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {getInitials(user?.name, user?.email)}
              </Text>
            </View>
          )}
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Info Cards */}
        <View style={styles.cards}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>User ID</Text>
            <Text style={styles.cardValue}>{user?.id}</Text>
          </View>

          {team && (
            <>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Current Team</Text>
                <Text style={styles.cardValue}>{team.name}</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Role</Text>
                <Text style={styles.cardValue}>{team.role}</Text>
              </View>
            </>
          )}
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
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#171717',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '600',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  cards: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
})
