/**
 * Create Customer Screen
 */

import { router } from 'expo-router'
import { CustomerForm } from '@/src/components/entities/customers'
import { useCreateCustomer, type CreateCustomerInput } from '@/src/entities/customers'

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
