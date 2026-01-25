/**
 * Home/Dashboard Screen
 */

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@/src/providers/AuthProvider'
import { useTasks } from '@/src/hooks/useTasks'
import { useCustomers } from '@/src/hooks/useCustomers'
import { Colors } from '@/src/constants/colors'

export default function HomeScreen() {
  const { user, team } = useAuth()
  const { data: tasksData } = useTasks()
  const { data: customersData } = useCustomers()

  const firstName = user?.name?.split(' ')[0] || 'Usuario'
  const taskCount = tasksData?.data?.length || 0
  const customerCount = customersData?.data?.length || 0

  // Count tasks by status
  const todoTasks = tasksData?.data?.filter((t) => t.status === 'todo').length || 0
  const inProgressTasks =
    tasksData?.data?.filter((t) => t.status === 'in-progress').length || 0

  return (
    <ScrollView style={styles.container}>
      {/* Welcome Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Dashboard</Text>
        <Text style={styles.welcomeText}>Bienvenido de vuelta, {firstName}</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.cardsContainer}>
        {/* Account Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Estado de Cuenta</Text>
            <Text style={styles.cardIcon}>📈</Text>
          </View>
          <Text style={styles.cardValue}>Activo</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>verificado</Text>
          </View>
        </View>

        {/* Plan Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Plan</Text>
            <Text style={styles.cardIcon}>💳</Text>
          </View>
          <Text style={styles.cardValue}>Gratis</Text>
          <TouchableOpacity>
            <Text style={styles.cardLink}>Actualizar plan →</Text>
          </TouchableOpacity>
        </View>

        {/* Tasks Summary Card */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/(app)/tasks')}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Mis Tareas</Text>
            <Text style={styles.cardIcon}>☑</Text>
          </View>
          <Text style={styles.cardValue}>{taskCount}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statItem}>
              <Text style={styles.statNumber}>{todoTasks}</Text> pendientes
            </Text>
            <Text style={styles.statItem}>
              <Text style={styles.statNumber}>{inProgressTasks}</Text> en progreso
            </Text>
          </View>
        </TouchableOpacity>

        {/* Customers Card */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/(app)/customers')}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Clientes</Text>
            <Text style={styles.cardIcon}>👥</Text>
          </View>
          <Text style={styles.cardValue}>{customerCount}</Text>
          <Text style={styles.cardLink}>Ver todos →</Text>
        </TouchableOpacity>

        {/* Team Card */}
        {team && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Equipo Actual</Text>
              <Text style={styles.cardIcon}>🏢</Text>
            </View>
            <Text style={styles.cardValue}>{team.name}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{team.userRole}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.foreground,
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 15,
    color: Colors.foregroundSecondary,
  },
  cardsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 14,
    color: Colors.foregroundSecondary,
    fontWeight: '500',
  },
  cardIcon: {
    fontSize: 18,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.foreground,
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.backgroundTertiary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    color: Colors.foregroundSecondary,
    fontWeight: '500',
  },
  cardLink: {
    fontSize: 14,
    color: Colors.foreground,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    fontSize: 13,
    color: Colors.foregroundSecondary,
  },
  statNumber: {
    fontWeight: '600',
    color: Colors.foreground,
  },
  spacer: {
    height: 40,
  },
})
