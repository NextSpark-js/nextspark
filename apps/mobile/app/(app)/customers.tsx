/**
 * Customers List Screen
 */

import { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { router } from 'expo-router'
import { useCustomers } from '@/src/hooks/useCustomers'
import { CustomerCard } from '@/src/components/CustomerCard'
import { Button } from '@/src/components/ui'
import { Colors } from '@/src/constants/colors'
import type { Customer } from '@/src/types'

export default function CustomersListScreen() {
  const { data, isLoading, error, refetch } = useCustomers()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  const handleCustomerPress = (customer: Customer) => {
    router.push(`/(app)/customer/${customer.id}`)
  }

  const renderCustomer = ({ item }: { item: Customer }) => (
    <CustomerCard customer={item} onPress={() => handleCustomerPress(item)} />
  )

  const renderEmpty = () => {
    if (isLoading) return null

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>👥</Text>
        <Text style={styles.emptyTitle}>Sin clientes</Text>
        <Text style={styles.emptyText}>
          Toca el botón Crear para agregar tu primer cliente
        </Text>
      </View>
    )
  }

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Algo salió mal</Text>
      <Text style={styles.errorText}>
        {error instanceof Error ? error.message : 'Error al cargar clientes'}
      </Text>
      <Button onPress={() => refetch()}>
        Reintentar
      </Button>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Page Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Clientes</Text>
        <Text style={styles.pageSubtitle}>
          Gestiona tu cartera de clientes
        </Text>
      </View>

      {/* Error State */}
      {error && renderError()}

      {/* Customers List */}
      {!error && (
        <FlatList
          data={data?.data || []}
          renderItem={renderCustomer}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
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
  pageSubtitle: {
    fontSize: 15,
    color: Colors.foregroundSecondary,
  },
  listContent: {
    paddingBottom: 12,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.foreground,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.foregroundSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.destructive,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.foregroundSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
})
