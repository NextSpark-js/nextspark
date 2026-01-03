'use client'

import { useQuery } from '@tanstack/react-query'
import { useTeam } from './useTeam'
import type { Invoice } from '../components/billing'

interface UseInvoiceOptions {
  invoiceNumber: string
  enabled?: boolean
}

interface InvoiceResponse {
  success: boolean
  data: Invoice & {
    description?: string
  }
}

export function useInvoice(options: UseInvoiceOptions) {
  const { teamId } = useTeam()
  const { invoiceNumber, enabled = true } = options

  return useQuery<InvoiceResponse>({
    queryKey: ['invoice', teamId, invoiceNumber],
    queryFn: async () => {
      if (!teamId) {
        throw new Error('No active team')
      }

      const response = await fetch(
        `/api/v1/teams/${teamId}/invoices/${encodeURIComponent(invoiceNumber)}`
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch invoice' }))
        throw new Error(error.message || 'Failed to fetch invoice')
      }

      return response.json()
    },
    enabled: enabled && !!teamId && !!invoiceNumber,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
