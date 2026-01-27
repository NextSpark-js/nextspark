/**
 * Home/Dashboard Screen
 */

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@/src/providers/AuthProvider'
import { useTasks } from '@/src/entities/tasks'
import { useCustomers } from '@/src/entities/customers'
import { Colors } from '@/src/constants/colors'
import { Button } from '@/src/components/ui'
import {
  Progress,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@nextsparkjs/ui'

export default function HomeScreen() {
  const { user, team } = useAuth()
  const { data: tasksData } = useTasks()
  const { data: customersData } = useCustomers()
  const [activeTab, setActiveTab] = useState('tab1')

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
          <Button variant="link" size="sm" style={{ alignSelf: 'flex-start', height: 'auto', paddingHorizontal: 0 }}>
            Actualizar plan →
          </Button>
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
              <Text style={styles.badgeText}>{team.role}</Text>
            </View>
          </View>
        )}
      </View>

      {/* === TEST COMPONENTS - Phase 3 Migration === */}
      <View style={styles.testSection}>
        <Text style={styles.testTitle}>Component Test (Phase 3)</Text>

        {/* Progress Test */}
        <View style={styles.testCard}>
          <Text style={styles.testLabel}>Progress Component</Text>
          <Progress value={30} style={{ marginBottom: 8 }} />
          <Progress value={60} style={{ marginBottom: 8 }} />
          <Progress value={90} />
        </View>

        {/* Tabs Test */}
        <View style={styles.testCard}>
          <Text style={styles.testLabel}>Tabs Component</Text>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="tab1">Tab 1</TabsTrigger>
              <TabsTrigger value="tab2">Tab 2</TabsTrigger>
              <TabsTrigger value="tab3">Tab 3</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">
              <Text style={styles.testText}>Content for Tab 1</Text>
            </TabsContent>
            <TabsContent value="tab2">
              <Text style={styles.testText}>Content for Tab 2</Text>
            </TabsContent>
            <TabsContent value="tab3">
              <Text style={styles.testText}>Content for Tab 3</Text>
            </TabsContent>
          </Tabs>
        </View>

        {/* Accordion Test */}
        <View style={styles.testCard}>
          <Text style={styles.testLabel}>Accordion Component</Text>
          <Accordion type="single" collapsible>
            <AccordionItem value="item1">
              <AccordionTrigger>Section 1</AccordionTrigger>
              <AccordionContent>
                <Text style={styles.testText}>This is the content for section 1.</Text>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item2">
              <AccordionTrigger>Section 2</AccordionTrigger>
              <AccordionContent>
                <Text style={styles.testText}>This is the content for section 2.</Text>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </View>
      </View>
      {/* === END TEST COMPONENTS === */}

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
  // Test section styles
  testSection: {
    padding: 16,
    marginTop: 16,
  },
  testTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.foreground,
    marginBottom: 16,
  },
  testCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  testLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.foregroundSecondary,
    marginBottom: 12,
  },
  testText: {
    fontSize: 14,
    color: Colors.foreground,
    paddingVertical: 8,
  },
})
