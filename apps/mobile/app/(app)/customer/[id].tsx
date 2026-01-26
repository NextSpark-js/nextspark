/**
 * Edit Customer Screen
 */

import { useLocalSearchParams, router } from 'expo-router'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { CustomerForm } from '@/src/components/entities/customers'
import { useCustomer, useUpdateCustomer, useDeleteCustomer, type UpdateCustomerInput } from '@/src/entities/customers'

export default function EditCustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, isLoading, error } = useCustomer(id)
  const updateCustomer = useUpdateCustomer()
  const deleteCustomer = useDeleteCustomer()

  const handleSubmit = async (formData: UpdateCustomerInput) => {
    if (!id) return
    await updateCustomer.mutateAsync({ id, data: formData })
    router.back()
  }

  const handleDelete = async () => {
    if (!id) return
    await deleteCustomer.mutateAsync(id)
    router.replace('/(app)/customers')
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    )
  }

  if (error || !data?.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Customer not found'}
        </Text>
      </View>
    )
  }

  return (
    <CustomerForm
      mode="edit"
      initialData={data.data}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      isLoading={updateCustomer.isPending || deleteCustomer.isPending}
    />
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 16,
  },
})
