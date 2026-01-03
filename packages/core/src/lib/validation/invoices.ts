import { z } from 'zod'

/**
 * Invoice Query Schema
 * Validation for pagination parameters when listing invoices
 */
export const invoiceQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
})

/**
 * Invoice Response Schema
 * Validation for invoice data structure in API responses
 */
export const invoiceResponseSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  invoiceNumber: z.string(),
  date: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(['pending', 'paid', 'failed', 'refunded']),
  pdfUrl: z.string().nullable(),
  description: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/**
 * Type inference for Invoice Response
 */
export type InvoiceResponse = z.infer<typeof invoiceResponseSchema>

/**
 * Type inference for Invoice Query
 */
export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>
