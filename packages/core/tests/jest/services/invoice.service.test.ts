/**
 * Unit Tests - InvoiceService
 *
 * Tests all InvoiceService methods for invoice management and revenue tracking.
 */

import { InvoiceService } from '@/core/lib/services/invoice.service'
import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@/core/lib/db'
import type { Invoice } from '@/core/lib/billing/types'

// Mock database functions
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
}))

const mockQueryOneWithRLS = queryOneWithRLS as jest.MockedFunction<typeof queryOneWithRLS>
const mockQueryWithRLS = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>
const mockMutateWithRLS = mutateWithRLS as jest.MockedFunction<typeof mutateWithRLS>

// Sample invoice data
const mockInvoice: Invoice = {
  id: 'inv-123',
  teamId: 'team-456',
  invoiceNumber: 'INV-2024-0001',
  date: '2024-01-15',
  amount: 99.00,
  currency: 'usd',
  status: 'pending',
  pdfUrl: null,
  description: 'Pro Plan - Monthly',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('InvoiceService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ===========================================
  // QUERIES
  // ===========================================

  describe('getById', () => {
    it('returns invoice when found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockInvoice)

      const result = await InvoiceService.getById('inv-123')

      expect(result).toEqual(mockInvoice)
    })

    it('returns null when not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await InvoiceService.getById('non-existent')

      expect(result).toBeNull()
    })

    it('throws error for empty id', async () => {
      await expect(InvoiceService.getById('')).rejects.toThrow('Invoice ID is required')
    })
  })

  describe('getByNumber', () => {
    it('returns invoice by number', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockInvoice)

      const result = await InvoiceService.getByNumber('INV-2024-0001')

      expect(result).toEqual(mockInvoice)
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"invoiceNumber" = $1'),
        ['INV-2024-0001']
      )
    })

    it('throws error for empty invoice number', async () => {
      await expect(InvoiceService.getByNumber('')).rejects.toThrow('Invoice number is required')
    })
  })

  describe('listByTeam', () => {
    it('returns invoices for team with pagination info', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([mockInvoice]) // invoices query
        .mockResolvedValueOnce([{ count: '1' }]) // count query

      const result = await InvoiceService.listByTeam('team-456')

      expect(result.invoices).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('respects limit and offset options', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([mockInvoice])
        .mockResolvedValueOnce([{ count: '1' }])

      await InvoiceService.listByTeam('team-456', { limit: 10, offset: 5 })

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining(['team-456', 10, 5])
      )
    })

    it('filters by status when provided', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([mockInvoice])
        .mockResolvedValueOnce([{ count: '1' }])

      await InvoiceService.listByTeam('team-456', { status: 'paid' })

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('status = $2'),
        expect.arrayContaining(['paid'])
      )
    })
  })

  describe('listBySubscription', () => {
    it('returns invoices for subscription', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ teamId: 'team-456' })
      mockQueryWithRLS.mockResolvedValue([mockInvoice])

      const result = await InvoiceService.listBySubscription('sub-123')

      expect(result).toHaveLength(1)
    })

    it('returns empty array when subscription not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await InvoiceService.listBySubscription('non-existent')

      expect(result).toEqual([])
    })
  })

  // ===========================================
  // MUTATIONS
  // ===========================================

  describe('create', () => {
    it('creates invoice with required fields', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [mockInvoice], rowCount: 1 })

      const result = await InvoiceService.create({
        teamId: 'team-456',
        invoiceNumber: 'INV-2024-0001',
        date: new Date('2024-01-15'),
        amount: 99.00,
        currency: 'usd',
        status: 'pending',
      })

      expect(result).toEqual(mockInvoice)
      expect(mockMutateWithRLS).toHaveBeenCalled()
    })

    it('uses provided invoice number', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [mockInvoice], rowCount: 1 })

      await InvoiceService.create({
        teamId: 'team-456',
        invoiceNumber: 'CUSTOM-001',
        date: new Date(),
        amount: 99.00,
        currency: 'usd',
        status: 'pending',
      })

      // The second parameter in the query should contain CUSTOM-001
      const callArgs = mockMutateWithRLS.mock.calls[0][1] as unknown[]
      expect(callArgs[1]).toBe('CUSTOM-001')
    })

    it('throws error for missing teamId', async () => {
      await expect(InvoiceService.create({
        teamId: '',
        invoiceNumber: 'INV-001',
        date: new Date(),
        amount: 99.00,
        currency: 'usd',
        status: 'pending',
      })).rejects.toThrow('Team ID is required')
    })

    it('throws error for missing invoice number', async () => {
      await expect(InvoiceService.create({
        teamId: 'team-456',
        invoiceNumber: '',
        date: new Date(),
        amount: 99.00,
        currency: 'usd',
        status: 'pending',
      })).rejects.toThrow('Invoice number is required')
    })
  })

  describe('updateStatus', () => {
    it('updates invoice status', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [{ ...mockInvoice, status: 'paid' }], rowCount: 1 })

      const result = await InvoiceService.updateStatus('inv-123', 'paid')

      expect(result.status).toBe('paid')
    })

    it('throws error when invoice not found', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [], rowCount: 0 })

      await expect(InvoiceService.updateStatus('non-existent', 'paid')).rejects.toThrow('Invoice not found: non-existent')
    })
  })

  describe('markAsPaid', () => {
    it('marks invoice as paid', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [{ ...mockInvoice, status: 'paid' }], rowCount: 1 })

      const result = await InvoiceService.markAsPaid('inv-123')

      expect(result.status).toBe('paid')
    })

    it('marks invoice as paid with payment details', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [{ ...mockInvoice, status: 'paid' }], rowCount: 1 })

      const result = await InvoiceService.markAsPaid('inv-123', {
        paymentMethod: 'card',
        transactionId: 'txn_123',
      })

      expect(result.status).toBe('paid')
    })

    it('throws error when invoice not found', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [], rowCount: 0 })

      await expect(InvoiceService.markAsPaid('non-existent')).rejects.toThrow('Invoice not found: non-existent')
    })
  })

  describe('updatePdfUrl', () => {
    it('updates PDF URL', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [{ ...mockInvoice, pdfUrl: 'https://example.com/inv.pdf' }], rowCount: 1 })

      const result = await InvoiceService.updatePdfUrl('inv-123', 'https://example.com/inv.pdf')

      expect(result.pdfUrl).toBe('https://example.com/inv.pdf')
    })
  })

  // ===========================================
  // HELPERS
  // ===========================================

  describe('generateNumber', () => {
    it('generates sequential invoice number', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ maxNumber: null })

      const result = await InvoiceService.generateNumber('team-456')

      expect(result).toMatch(/^INV-\d{4}-0001$/)
    })

    it('increments from last invoice number', async () => {
      const year = new Date().getFullYear()
      mockQueryOneWithRLS.mockResolvedValue({ maxNumber: `INV-${year}-0005` })

      const result = await InvoiceService.generateNumber('team-456')

      expect(result).toBe(`INV-${year}-0006`)
    })
  })

  describe('getPdfUrl', () => {
    it('returns PDF URL when available', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ pdfUrl: 'https://example.com/inv.pdf' })

      const result = await InvoiceService.getPdfUrl('inv-123')

      expect(result).toBe('https://example.com/inv.pdf')
    })

    it('returns null when invoice not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await InvoiceService.getPdfUrl('non-existent')

      expect(result).toBeNull()
    })

    it('returns null for empty id', async () => {
      const result = await InvoiceService.getPdfUrl('')

      expect(result).toBeNull()
      expect(mockQueryOneWithRLS).not.toHaveBeenCalled()
    })
  })

  // ===========================================
  // ADVANCED QUERIES
  // ===========================================

  describe('listOverdue', () => {
    it('returns overdue invoices', async () => {
      mockQueryWithRLS.mockResolvedValue([mockInvoice])

      const result = await InvoiceService.listOverdue()

      expect(result).toHaveLength(1)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining("status = 'pending'"),
        expect.any(Array)
      )
    })
  })

  describe('listByDateRange', () => {
    it('returns invoices in date range', async () => {
      mockQueryWithRLS.mockResolvedValue([mockInvoice])

      const result = await InvoiceService.listByDateRange(
        new Date('2024-01-01'),
        new Date('2024-12-31')
      )

      expect(result).toHaveLength(1)
    })

    it('filters by team when provided', async () => {
      mockQueryWithRLS.mockResolvedValue([mockInvoice])

      await InvoiceService.listByDateRange(
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        'team-456'
      )

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"teamId" = $3'),
        expect.arrayContaining(['team-456'])
      )
    })

    it('throws error for missing dates', async () => {
      await expect(
        InvoiceService.listByDateRange(null as unknown as Date, new Date())
      ).rejects.toThrow('Start and end dates are required')
    })

    it('throws error when start date is after end date', async () => {
      await expect(
        InvoiceService.listByDateRange(
          new Date('2024-12-31'),
          new Date('2024-01-01')
        )
      ).rejects.toThrow('Start date must be before end date')
    })
  })

  describe('getLastForTeam', () => {
    it('returns most recent invoice', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockInvoice)

      const result = await InvoiceService.getLastForTeam('team-456')

      expect(result).toEqual(mockInvoice)
    })
  })

  describe('getRevenueSummary', () => {
    it('returns revenue summary for year/month', async () => {
      mockQueryWithRLS.mockResolvedValue([
        { status: 'paid', total: 1500.00 },
        { status: 'pending', total: 200.00 },
      ])

      const result = await InvoiceService.getRevenueSummary(2024, 1)

      expect(result.paid).toBe(1500)
      expect(result.pending).toBe(200)
      expect(result.total).toBe(1700)
    })

    it('returns zeros when no invoices', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      const result = await InvoiceService.getRevenueSummary(2024)

      expect(result.paid).toBe(0)
      expect(result.pending).toBe(0)
      expect(result.failed).toBe(0)
      expect(result.total).toBe(0)
    })
  })

  describe('exists', () => {
    it('returns true when invoice exists', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ id: 'inv-123' })

      const result = await InvoiceService.exists('INV-2024-0001', 'team-456')

      expect(result).toBe(true)
    })

    it('returns false when invoice does not exist', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await InvoiceService.exists('INV-2024-9999', 'team-456')

      expect(result).toBe(false)
    })

    it('returns false for missing parameters', async () => {
      const result = await InvoiceService.exists('', 'team-456')

      expect(result).toBe(false)
    })
  })

  // ===========================================
  // REPORTING
  // ===========================================

  describe('getTotalPaid', () => {
    it('returns total paid amount for team', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ total: 1500.00 })

      const result = await InvoiceService.getTotalPaid('team-456')

      expect(result).toBe(1500)
    })

    it('returns total for specific year', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ total: 500.00 })

      const result = await InvoiceService.getTotalPaid('team-456', 2024)

      expect(result).toBe(500)
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('EXTRACT(YEAR'),
        expect.arrayContaining(['team-456', 2024])
      )
    })

    it('returns 0 when no paid invoices', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ total: null })

      const result = await InvoiceService.getTotalPaid('team-456')

      expect(result).toBe(0)
    })

    it('returns 0 for empty teamId', async () => {
      const result = await InvoiceService.getTotalPaid('')

      expect(result).toBe(0)
      expect(mockQueryOneWithRLS).not.toHaveBeenCalled()
    })
  })
})
