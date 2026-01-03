/**
 * Invoice Service
 *
 * Provides invoice management functions for billing operations.
 * Invoices are synced from Stripe and stored locally for fast access.
 *
 * @module InvoiceService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '../db'
import type { Invoice, InvoiceStatus } from '../billing/types'

// ===========================================
// CONSTANTS
// ===========================================

/**
 * Standard SELECT columns for invoice queries
 * Ensures consistent field selection and amount conversion
 */
const INVOICE_SELECT_COLUMNS = `
  id,
  "teamId",
  "invoiceNumber",
  date,
  amount::NUMERIC(10,2)::FLOAT as amount,
  currency,
  status,
  "pdfUrl",
  description,
  "createdAt",
  "updatedAt"
` as const

// ===========================================
// TYPES
// ===========================================

export interface ListInvoicesOptions {
  /** Maximum number of invoices to return (default: 10) */
  limit?: number
  /** Offset for pagination (default: 0) */
  offset?: number
  /** Filter by status */
  status?: InvoiceStatus
}

export interface ListInvoicesResult {
  invoices: Invoice[]
  total: number
}

export interface CreateInvoicePayload {
  teamId: string
  invoiceNumber: string
  date: Date
  /** Amount in dollars (not cents) */
  amount: number
  currency: string
  status: InvoiceStatus
  pdfUrl?: string | null
  description?: string | null
}

export interface PaymentDetails {
  paidAt?: Date
  paymentMethod?: string
  transactionId?: string
}

// ===========================================
// SERVICE
// ===========================================

export class InvoiceService {
  // ===========================================
  // QUERIES
  // ===========================================

  /**
   * Get invoice by ID
   *
   * @param id - Invoice ID
   * @returns Invoice or null if not found
   *
   * @example
   * const invoice = await InvoiceService.getById('inv-123')
   */
  static async getById(id: string): Promise<Invoice | null> {
    if (!id || id.trim() === '') {
      throw new Error('Invoice ID is required')
    }

    return queryOneWithRLS<Invoice>(
      `SELECT ${INVOICE_SELECT_COLUMNS} FROM "invoices" WHERE id = $1`,
      [id]
    )
  }

  /**
   * Get invoice by invoice number
   *
   * @param invoiceNumber - Invoice number (e.g., 'INV-2024-001')
   * @param teamId - Optional team ID for additional filtering
   * @returns Invoice or null if not found
   *
   * @example
   * const invoice = await InvoiceService.getByNumber('INV-2024-001', 'team-123')
   */
  static async getByNumber(invoiceNumber: string, teamId?: string): Promise<Invoice | null> {
    if (!invoiceNumber || invoiceNumber.trim() === '') {
      throw new Error('Invoice number is required')
    }

    if (teamId) {
      return queryOneWithRLS<Invoice>(
        `SELECT ${INVOICE_SELECT_COLUMNS} FROM "invoices"
         WHERE "invoiceNumber" = $1 AND "teamId" = $2`,
        [invoiceNumber, teamId]
      )
    }

    return queryOneWithRLS<Invoice>(
      `SELECT ${INVOICE_SELECT_COLUMNS} FROM "invoices" WHERE "invoiceNumber" = $1`,
      [invoiceNumber]
    )
  }

  /**
   * List invoices for a team with pagination
   *
   * @param teamId - Team ID
   * @param options - List options (limit, offset, status filter)
   * @returns Invoices array and total count
   *
   * @example
   * const { invoices, total } = await InvoiceService.listByTeam('team-123', {
   *   limit: 10,
   *   offset: 0,
   *   status: 'paid'
   * })
   */
  static async listByTeam(
    teamId: string,
    options: ListInvoicesOptions = {}
  ): Promise<ListInvoicesResult> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    const { limit = 10, offset = 0, status } = options

    // Build query with optional status filter
    let query = `SELECT ${INVOICE_SELECT_COLUMNS} FROM "invoices" WHERE "teamId" = $1`
    let countQuery = `SELECT COUNT(*) as count FROM "invoices" WHERE "teamId" = $1`
    const params: unknown[] = [teamId]

    if (status) {
      query += ` AND status = $2`
      countQuery += ` AND status = $2`
      params.push(status)
    }

    query += ` ORDER BY date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`

    const invoices = await queryWithRLS<Invoice>(query, [...params, limit, offset])

    const totalResult = await queryWithRLS<{ count: string }>(countQuery, params)
    const total = parseInt(totalResult[0]?.count || '0', 10)

    return { invoices, total }
  }

  /**
   * List invoices for a subscription
   *
   * @param subscriptionId - Subscription ID
   * @returns Array of invoices
   *
   * @example
   * const invoices = await InvoiceService.listBySubscription('sub-123')
   */
  static async listBySubscription(subscriptionId: string): Promise<Invoice[]> {
    if (!subscriptionId || subscriptionId.trim() === '') {
      throw new Error('Subscription ID is required')
    }

    // Get team from subscription first
    const subscription = await queryOneWithRLS<{ teamId: string }>(
      `SELECT "teamId" FROM "subscriptions" WHERE id = $1`,
      [subscriptionId]
    )

    if (!subscription) {
      return []
    }

    return queryWithRLS<Invoice>(
      `SELECT ${INVOICE_SELECT_COLUMNS} FROM "invoices"
       WHERE "teamId" = $1 ORDER BY date DESC`,
      [subscription.teamId]
    )
  }

  /**
   * List overdue invoices (pending and past due date)
   *
   * @param options - Pagination options
   * @returns Array of overdue invoices
   *
   * @example
   * const overdueInvoices = await InvoiceService.listOverdue()
   */
  static async listOverdue(
    options: { limit?: number; offset?: number } = {}
  ): Promise<Invoice[]> {
    const { limit = 100, offset = 0 } = options

    return queryWithRLS<Invoice>(
      `SELECT ${INVOICE_SELECT_COLUMNS} FROM "invoices"
       WHERE status = 'pending' AND date < NOW()
       ORDER BY date ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )
  }

  /**
   * List invoices by date range
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @param teamId - Optional team ID to filter
   * @returns Array of invoices within the date range
   *
   * @example
   * const q1Invoices = await InvoiceService.listByDateRange(
   *   new Date('2024-01-01'),
   *   new Date('2024-03-31')
   * )
   */
  static async listByDateRange(
    startDate: Date,
    endDate: Date,
    teamId?: string
  ): Promise<Invoice[]> {
    if (!startDate || !endDate) {
      throw new Error('Start and end dates are required')
    }

    if (startDate > endDate) {
      throw new Error('Start date must be before end date')
    }

    if (teamId) {
      return queryWithRLS<Invoice>(
        `SELECT ${INVOICE_SELECT_COLUMNS} FROM "invoices"
         WHERE date >= $1 AND date <= $2 AND "teamId" = $3
         ORDER BY date DESC`,
        [startDate.toISOString(), endDate.toISOString(), teamId]
      )
    }

    return queryWithRLS<Invoice>(
      `SELECT ${INVOICE_SELECT_COLUMNS} FROM "invoices"
       WHERE date >= $1 AND date <= $2
       ORDER BY date DESC`,
      [startDate.toISOString(), endDate.toISOString()]
    )
  }

  /**
   * Get the most recent invoice for a team
   *
   * @param teamId - Team ID
   * @returns Most recent invoice or null
   *
   * @example
   * const lastInvoice = await InvoiceService.getLastForTeam('team-123')
   */
  static async getLastForTeam(teamId: string): Promise<Invoice | null> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    return queryOneWithRLS<Invoice>(
      `SELECT ${INVOICE_SELECT_COLUMNS} FROM "invoices"
       WHERE "teamId" = $1
       ORDER BY date DESC
       LIMIT 1`,
      [teamId]
    )
  }

  /**
   * Get revenue summary for a period
   *
   * @param year - Year to filter
   * @param month - Optional month to filter (1-12)
   * @returns Revenue summary with totals by status
   *
   * @example
   * const revenue = await InvoiceService.getRevenueSummary(2024)
   * const janRevenue = await InvoiceService.getRevenueSummary(2024, 1)
   */
  static async getRevenueSummary(
    year: number,
    month?: number
  ): Promise<{ paid: number; pending: number; failed: number; total: number }> {
    let dateFilter = `EXTRACT(YEAR FROM date) = $1`
    const params: unknown[] = [year]

    if (month) {
      dateFilter += ` AND EXTRACT(MONTH FROM date) = $2`
      params.push(month)
    }

    const results = await queryWithRLS<{ status: string; total: number }>(
      `SELECT status, COALESCE(SUM(amount), 0)::NUMERIC(10,2)::FLOAT as total
       FROM "invoices"
       WHERE ${dateFilter}
       GROUP BY status`,
      params
    )

    const summary = { paid: 0, pending: 0, failed: 0, total: 0 }
    for (const row of results) {
      if (row.status === 'paid') summary.paid = row.total
      else if (row.status === 'pending') summary.pending = row.total
      else if (row.status === 'failed') summary.failed = row.total
      summary.total += row.total
    }

    return summary
  }

  // ===========================================
  // MUTATIONS
  // ===========================================

  /**
   * Create a new invoice
   *
   * @param data - Invoice data
   * @returns Created invoice
   *
   * @example
   * const invoice = await InvoiceService.create({
   *   teamId: 'team-123',
   *   invoiceNumber: 'INV-2024-001',
   *   date: new Date(),
   *   amount: 29.00,
   *   currency: 'USD',
   *   status: 'pending',
   * })
   */
  static async create(data: CreateInvoicePayload): Promise<Invoice> {
    const { teamId, invoiceNumber, date, amount, currency, status, pdfUrl, description } = data

    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    if (!invoiceNumber || invoiceNumber.trim() === '') {
      throw new Error('Invoice number is required')
    }

    const result = await mutateWithRLS<Invoice>(
      `
      INSERT INTO "invoices" (
        "teamId",
        "invoiceNumber",
        date,
        amount,
        currency,
        status,
        "pdfUrl",
        description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        "teamId",
        "invoiceNumber",
        date,
        amount::NUMERIC(10,2)::FLOAT as amount,
        currency,
        status,
        "pdfUrl",
        description,
        "createdAt",
        "updatedAt"
      `,
      [teamId, invoiceNumber, date, amount, currency, status, pdfUrl || null, description || null]
    )

    if (!result.rows[0]) {
      throw new Error('Failed to create invoice')
    }

    return result.rows[0]
  }

  /**
   * Update invoice status
   *
   * @param id - Invoice ID
   * @param status - New status
   * @returns Updated invoice
   *
   * @example
   * const invoice = await InvoiceService.updateStatus('inv-123', 'paid')
   */
  static async updateStatus(id: string, status: InvoiceStatus): Promise<Invoice> {
    if (!id || id.trim() === '') {
      throw new Error('Invoice ID is required')
    }

    if (!status) {
      throw new Error('Status is required')
    }

    const result = await mutateWithRLS<Invoice>(
      `
      UPDATE "invoices"
      SET status = $2, "updatedAt" = NOW()
      WHERE id = $1
      RETURNING
        id,
        "teamId",
        "invoiceNumber",
        date,
        amount::NUMERIC(10,2)::FLOAT as amount,
        currency,
        status,
        "pdfUrl",
        description,
        "createdAt",
        "updatedAt"
      `,
      [id, status]
    )

    if (!result.rows[0]) {
      throw new Error(`Invoice not found: ${id}`)
    }

    return result.rows[0]
  }

  /**
   * Mark invoice as paid
   *
   * @param id - Invoice ID
   * @param _paymentDetails - Optional payment details (reserved for future use)
   * @returns Updated invoice
   *
   * @example
   * const invoice = await InvoiceService.markAsPaid('inv-123')
   */
  static async markAsPaid(id: string, _paymentDetails?: PaymentDetails): Promise<Invoice> {
    return this.updateStatus(id, 'paid')
  }

  /**
   * Update invoice PDF URL
   *
   * @param id - Invoice ID
   * @param pdfUrl - PDF URL from Stripe
   * @returns Updated invoice
   *
   * @example
   * await InvoiceService.updatePdfUrl('inv-123', 'https://stripe.com/...')
   */
  static async updatePdfUrl(id: string, pdfUrl: string): Promise<Invoice> {
    if (!id || id.trim() === '') {
      throw new Error('Invoice ID is required')
    }

    const result = await mutateWithRLS<Invoice>(
      `
      UPDATE "invoices"
      SET "pdfUrl" = $2, "updatedAt" = NOW()
      WHERE id = $1
      RETURNING
        id,
        "teamId",
        "invoiceNumber",
        date,
        amount::NUMERIC(10,2)::FLOAT as amount,
        currency,
        status,
        "pdfUrl",
        description,
        "createdAt",
        "updatedAt"
      `,
      [id, pdfUrl]
    )

    if (!result.rows[0]) {
      throw new Error(`Invoice not found: ${id}`)
    }

    return result.rows[0]
  }

  // ===========================================
  // HELPERS
  // ===========================================

  /**
   * Generate a unique invoice number for a team
   *
   * Format: INV-YYYY-NNNN (e.g., INV-2024-0001)
   *
   * @param teamId - Team ID
   * @returns Generated invoice number
   *
   * @example
   * const number = await InvoiceService.generateNumber('team-123')
   * // 'INV-2024-0001'
   */
  static async generateNumber(teamId: string): Promise<string> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    const year = new Date().getFullYear()
    const prefix = `INV-${year}-`

    // Get the highest invoice number for this year
    const result = await queryOneWithRLS<{ maxNumber: string | null }>(
      `
      SELECT MAX("invoiceNumber") as "maxNumber"
      FROM "invoices"
      WHERE "teamId" = $1
        AND "invoiceNumber" LIKE $2
      `,
      [teamId, `${prefix}%`]
    )

    let nextNumber = 1

    if (result?.maxNumber) {
      // Extract the numeric part (last 4 digits)
      const currentNumber = parseInt(result.maxNumber.slice(-4), 10)
      if (!isNaN(currentNumber)) {
        nextNumber = currentNumber + 1
      }
    }

    // Pad with zeros to 4 digits
    return `${prefix}${nextNumber.toString().padStart(4, '0')}`
  }

  /**
   * Get PDF URL for an invoice
   *
   * @param id - Invoice ID
   * @returns PDF URL or null if not available
   *
   * @example
   * const url = await InvoiceService.getPdfUrl('inv-123')
   */
  static async getPdfUrl(id: string): Promise<string | null> {
    if (!id || id.trim() === '') {
      return null
    }

    const invoice = await queryOneWithRLS<{ pdfUrl: string | null }>(
      `SELECT "pdfUrl" FROM "invoices" WHERE id = $1`,
      [id]
    )

    return invoice?.pdfUrl ?? null
  }

  /**
   * Check if an invoice exists
   *
   * @param invoiceNumber - Invoice number
   * @param teamId - Team ID
   * @returns True if invoice exists
   *
   * @example
   * const exists = await InvoiceService.exists('INV-2024-0001', 'team-123')
   */
  static async exists(invoiceNumber: string, teamId: string): Promise<boolean> {
    if (!invoiceNumber || !teamId) {
      return false
    }

    const result = await queryOneWithRLS<{ id: string }>(
      `SELECT id FROM "invoices" WHERE "invoiceNumber" = $1 AND "teamId" = $2 LIMIT 1`,
      [invoiceNumber, teamId]
    )

    return !!result
  }

  /**
   * Get total amount for a team's invoices (paid only)
   *
   * @param teamId - Team ID
   * @param year - Optional year filter
   * @returns Total amount in dollars
   *
   * @example
   * const total = await InvoiceService.getTotalPaid('team-123', 2024)
   */
  static async getTotalPaid(teamId: string, year?: number): Promise<number> {
    if (!teamId || teamId.trim() === '') {
      return 0
    }

    let query = `
      SELECT COALESCE(SUM(amount), 0)::NUMERIC(10,2)::FLOAT as total
      FROM "invoices"
      WHERE "teamId" = $1 AND status = 'paid'
    `
    const params: unknown[] = [teamId]

    if (year) {
      query += ` AND EXTRACT(YEAR FROM date) = $2`
      params.push(year)
    }

    const result = await queryOneWithRLS<{ total: number }>(query, params)

    return result?.total ?? 0
  }
}
