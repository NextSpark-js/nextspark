/**
 * CRM Theme Utilities
 * Helper functions for the CRM theme
 */

/**
 * Format currency with proper symbol and decimals
 */
export function formatCurrency(
    amount: number,
    currency: string = 'USD',
    locale: string = 'en-US'
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
export function formatRelativeDate(date: Date | string | null | undefined): string {
    if (!date) {
        return '-'
    }
    const d = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000)

    if (diffInSeconds < 60) {
        return 'just now'
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`
    }

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) {
        return `${diffInHours}h ago`
    }

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays === 1) {
        return 'yesterday'
    }
    if (diffInDays < 7) {
        return `${diffInDays}d ago`
    }

    return d.toLocaleDateString()
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
