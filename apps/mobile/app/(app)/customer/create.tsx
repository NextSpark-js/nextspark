/**
 * Create Customer Screen
 */

import { router } from 'expo-router'
import { CustomerForm } from '@/src/components/CustomerForm'
import { useCreateCustomer } from '@/src/hooks/useCustomers'
import type { CreateCustomerInput } from '@/src/types'

export default function CreateCustomerScreen() {
  const createCustomer = useCreateCustomer()

  const handleSubmit = async (data: CreateCustomerInput) => {
    await createCustomer.mutateAsync(data)
    router.back()
  }

  return (
    <CustomerForm
      mode="create"
      onSubmit={handleSubmit}
      isLoading={createCustomer.isPending}
    />
  )
}
