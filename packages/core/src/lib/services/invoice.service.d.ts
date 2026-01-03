/**
 * Invoice Service
 *
 * Provides invoice management functions for billing operations.
 * Invoices are synced from Stripe and stored locally for fast access.
 *
 * @module InvoiceService
 */
import type { Invoice, InvoiceStatus } from '../billing/types';
export interface ListInvoicesOptions {
    /** Maximum number of invoices to return (default: 10) */
    limit?: number;
    /** Offset for pagination (default: 0) */
    offset?: number;
    /** Filter by status */
    status?: InvoiceStatus;
}
export interface ListInvoicesResult {
    invoices: Invoice[];
    total: number;
}
export interface CreateInvoicePayload {
    teamId: string;
    invoiceNumber: string;
    date: Date;
    /** Amount in dollars (not cents) */
    amount: number;
    currency: string;
    status: InvoiceStatus;
    pdfUrl?: string | null;
    description?: string | null;
}
export interface PaymentDetails {
    paidAt?: Date;
    paymentMethod?: string;
    transactionId?: string;
}
export declare class InvoiceService {
    /**
     * Get invoice by ID
     *
     * @param id - Invoice ID
     * @returns Invoice or null if not found
     *
     * @example
     * const invoice = await InvoiceService.getById('inv-123')
     */
    static getById(id: string): Promise<Invoice | null>;
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
    static getByNumber(invoiceNumber: string, teamId?: string): Promise<Invoice | null>;
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
    static listByTeam(teamId: string, options?: ListInvoicesOptions): Promise<ListInvoicesResult>;
    /**
     * List invoices for a subscription
     *
     * @param subscriptionId - Subscription ID
     * @returns Array of invoices
     *
     * @example
     * const invoices = await InvoiceService.listBySubscription('sub-123')
     */
    static listBySubscription(subscriptionId: string): Promise<Invoice[]>;
    /**
     * List overdue invoices (pending and past due date)
     *
     * @param options - Pagination options
     * @returns Array of overdue invoices
     *
     * @example
     * const overdueInvoices = await InvoiceService.listOverdue()
     */
    static listOverdue(options?: {
        limit?: number;
        offset?: number;
    }): Promise<Invoice[]>;
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
    static listByDateRange(startDate: Date, endDate: Date, teamId?: string): Promise<Invoice[]>;
    /**
     * Get the most recent invoice for a team
     *
     * @param teamId - Team ID
     * @returns Most recent invoice or null
     *
     * @example
     * const lastInvoice = await InvoiceService.getLastForTeam('team-123')
     */
    static getLastForTeam(teamId: string): Promise<Invoice | null>;
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
    static getRevenueSummary(year: number, month?: number): Promise<{
        paid: number;
        pending: number;
        failed: number;
        total: number;
    }>;
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
    static create(data: CreateInvoicePayload): Promise<Invoice>;
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
    static updateStatus(id: string, status: InvoiceStatus): Promise<Invoice>;
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
    static markAsPaid(id: string, _paymentDetails?: PaymentDetails): Promise<Invoice>;
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
    static updatePdfUrl(id: string, pdfUrl: string): Promise<Invoice>;
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
    static generateNumber(teamId: string): Promise<string>;
    /**
     * Get PDF URL for an invoice
     *
     * @param id - Invoice ID
     * @returns PDF URL or null if not available
     *
     * @example
     * const url = await InvoiceService.getPdfUrl('inv-123')
     */
    static getPdfUrl(id: string): Promise<string | null>;
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
    static exists(invoiceNumber: string, teamId: string): Promise<boolean>;
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
    static getTotalPaid(teamId: string, year?: number): Promise<number>;
}
//# sourceMappingURL=invoice.service.d.ts.map