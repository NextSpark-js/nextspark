/**
 * CRM Theme Constants
 * Shared constants for the CRM theme
 */

export const PIPELINE_STAGE_COLORS = {
    qualification: '#3B82F6',
    analysis: '#10B981',
    proposal: '#F59E0B',
    negotiation: '#8B5CF6',
    won: '#059669',
    lost: '#DC2626',
} as const

export const ACTIVITY_TYPE_COLORS = {
    call: '#3B82F6',
    email: '#8B5CF6',
    meeting: '#10B981',
    task: '#F59E0B',
    note: '#6B7280',
} as const

export const ACTIVITY_TYPE_ICONS = {
    call: '📞',
    email: '📧',
    meeting: '🤝',
    task: '✅',
    note: '📝',
    demo: '🎬',
    presentation: '📊',
} as const

export const PRIORITY_LEVELS = {
    low: { label: 'Low', color: '#9CA3AF' },
    medium: { label: 'Medium', color: '#F59E0B' },
    high: { label: 'High', color: '#EF4444' },
    urgent: { label: 'Urgent', color: '#DC2626' },
} as const

export const LEAD_STATUS_OPTIONS = [
    { value: 'new', label: 'New', color: '#3B82F6' },
    { value: 'contacted', label: 'Contacted', color: '#10B981' },
    { value: 'qualified', label: 'Qualified', color: '#F59E0B' },
    { value: 'proposal', label: 'Proposal', color: '#8B5CF6' },
    { value: 'negotiation', label: 'Negotiation', color: '#EC4899' },
    { value: 'converted', label: 'Converted', color: '#059669' },
    { value: 'lost', label: 'Lost', color: '#DC2626' },
] as const

export const OPPORTUNITY_STATUS_OPTIONS = [
    { value: 'open', label: 'Open', color: '#3B82F6' },
    { value: 'won', label: 'Won', color: '#059669' },
    { value: 'lost', label: 'Lost', color: '#DC2626' },
    { value: 'abandoned', label: 'Abandoned', color: '#6B7280' },
] as const

export const DEFAULT_PIPELINE_STAGES = [
    { order: 1, name: 'Qualification', probability: 10, color: '#3B82F6' },
    { order: 2, name: 'Needs Analysis', probability: 25, color: '#10B981' },
    { order: 3, name: 'Proposal', probability: 50, color: '#F59E0B' },
    { order: 4, name: 'Negotiation', probability: 75, color: '#8B5CF6' },
    { order: 5, name: 'Closed Won', probability: 100, color: '#059669' },
    { order: 6, name: 'Closed Lost', probability: 0, color: '#EF4444' },
] as const

export const CRM_ROUTES = {
    dashboard: '/dashboard/crm',
    pipelines: '/dashboard/crm/pipelines',
    opportunities: '/dashboard/crm/opportunities',
    activities: '/dashboard/crm/activities',
    leads: '/dashboard/crm/leads',
    contacts: '/dashboard/crm/contacts',
    companies: '/dashboard/crm/companies',
    campaigns: '/dashboard/crm/campaigns',
    products: '/dashboard/crm/products',
    notes: '/dashboard/crm/notes',
} as const
