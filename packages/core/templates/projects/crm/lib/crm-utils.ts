/**
 * CRM Theme Utilities
 * Helper functions for the CRM theme
 */

import { formatLocaleDate, formatLocaleRelative } from '@nextsparkjs/core/lib/i18n/format'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'

/**
 * A number from a value that may arrive as a number or as a string (the API returns NUMERIC columns as strings),
 * or null when it is not a finite number.
 */
export function toNumber(value: unknown): number | null {
    const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
    return Number.isFinite(number) ? number : null
}

/** The sum of the valid numbers in `values`: one that is not a finite number is ignored instead of turning the total into NaN. */
export function sumNumeric(values: unknown[]): number {
    return values.reduce<number>((sum, value) => sum + (toNumber(value) ?? 0), 0)
}

/**
 * The rows of a list endpoint for a lookup (company names, counters); an endpoint that fails gives no rows, so the page still renders.
 * The API sends the columns of the table only: a contact carries `companyId`, not the name of the company.
 */
export async function fetchRows<T>(endpoint: string): Promise<T[]> {
    try {
        const response = await fetchWithTeam(`${endpoint}?limit=100`)
        if (!response.ok) return []
        const result = await response.json()
        return Array.isArray(result.data) ? result.data : []
    } catch {
        return []
    }
}

/** The rows with `companyName` filled in from their `companyId` (a row that has its own name keeps it). */
export function withCompanyName<T extends { companyId?: string | null; companyName?: string }>(rows: T[], companies: { id: string; name?: string }[]): T[] {
    const names = new Map(companies.map(company => [company.id, company.name]))
    return rows.map(row => ({ ...row, companyName: row.companyName || (row.companyId ? names.get(row.companyId) : undefined) }))
}

/**
 * The companies with the number of contacts and of opportunities that point to them, and the value of the open ones:
 * the companies table has no such columns.
 */
export function withCompanyCounts<C extends { id: string }>(
    companies: C[],
    contacts: { companyId?: string | null }[],
    opportunities: { companyId?: string | null; amount?: unknown; status?: string | null }[],
): (C & { contactCount: number; opportunityCount: number; totalPipelineValue: number })[] {
    return companies.map(company => {
        const own = opportunities.filter(opportunity => opportunity.companyId === company.id)
        return {
            ...company,
            contactCount: contacts.filter(contact => contact.companyId === company.id).length,
            opportunityCount: own.length,
            totalPipelineValue: sumNumeric(own.filter(opportunity => (opportunity.status ?? 'open') === 'open').map(opportunity => opportunity.amount)),
        }
    })
}

/** A product with the `status` and `sku` the list reads: the table has `isActive` and `code`. */
export function withProductStatus<T extends { status?: string; isActive?: boolean | null; sku?: string; code?: string | null }>(product: T): T {
    return {
        ...product,
        status: product.status ?? (product.isActive === false ? 'inactive' : 'active'),
        sku: product.sku ?? product.code ?? undefined,
    }
}

/**
 * Format currency with proper symbol and decimals
 */
export function formatCurrency(
    amount: number,
    currency: string = 'USD',
    locale: string = 'en'
): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount)
}

/**
 * Format large numbers with K, M, B suffixes
 */
export function formatCompactNumber(num: number): string {
    if (num >= 1_000_000_000) {
        return `${(num / 1_000_000_000).toFixed(1)}B`
    }
    if (num >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(1)}M`
    }
    if (num >= 1_000) {
        return `${(num / 1_000).toFixed(1)}K`
    }
    return num.toString()
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(
    current: number,
    previous: number
): { value: number; isPositive: boolean } {
    if (previous === 0) {
        return { value: 100, isPositive: current > 0 }
    }

    const change = ((current - previous) / previous) * 100
    return {
        value: Math.abs(change),
        isPositive: change >= 0,
    }
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
    return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Check if a deal is rotten (stale) based on last update
 */
export function isDealRotten(
    updatedAt: Date | string,
    rottenDays: number = 30
): boolean {
    const lastUpdate = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt
    const daysSinceUpdate = daysBetween(new Date(), lastUpdate)
    return daysSinceUpdate > rottenDays
}

/**
 * Format date relative to now (e.g., "2 hours ago", "yesterday")
 */
export function formatRelativeDate(date: Date | string | null | undefined, locale: string = 'en'): string {
    if (!date) {
        return '-'
    }
    const d = typeof date === 'string' ? new Date(date) : date
    // within a week (past or future) in words of the locale ("yesterday", "hace 3 días"), then the date
    if (Math.abs(Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000) {
        return formatLocaleRelative(d, locale)
    }

    return formatLocaleDate(d, locale)
}

/**
 * Get badge variant based on status
 */
export function getStatusVariant(
    status: string
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
    const lowerStatus = status.toLowerCase()

    if (['won', 'completed', 'active', 'converted', 'success'].includes(lowerStatus)) {
        return 'success'
    }

    if (['pending', 'in_progress', 'scheduled', 'proposal', 'negotiation'].includes(lowerStatus)) {
        return 'warning'
    }

    if (['lost', 'cancelled', 'overdue', 'failed'].includes(lowerStatus)) {
        return 'danger'
    }

    if (['new', 'open', 'qualification'].includes(lowerStatus)) {
        return 'info'
    }

    return 'neutral'
}

/**
 * Calculate expected revenue from amount and probability
 */
export function calculateExpectedRevenue(amount: number, probability: number): number {
    return (amount * probability) / 100
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text
    }
    return text.slice(0, maxLength) + '...'
}

/**
 * Format phone number to international format
 */
export function formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '')

    // Format based on length
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }

    if (cleaned.length === 11 && cleaned[0] === '1') {
        return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }

    return phone // Return original if format is unknown
}
