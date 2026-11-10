/**
 * Contacts Page
 * Professional contacts management with data table and bulk actions
 */

'use client'

import { useLocale, useTranslations } from 'next-intl'
import { formatLocaleDate, formatLocaleNumber, formatLocaleRelative } from '@nextsparkjs/core/lib/i18n/format'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { CRMDataTable, type Column, type BulkAction } from '@/templates/shared/CRMDataTable'
import {
    Plus,
    Users,
    Trash2,
    Download,
    Mail,
    Phone,
    Building2,
    Tag,
    Clock,
    Send
} from 'lucide-react'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import { fetchRows, withCompanyName } from '@/lib/crm-utils'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { cn } from '@nextsparkjs/core/lib/utils'
import { usePermission } from '@nextsparkjs/core/lib/permissions/hooks'

interface Contact {
    id: string
    firstName: string
    lastName: string
    email: string
    phone?: string
    companyId?: string
    companyName?: string
    title?: string
    department?: string
    tags?: string[]
    lastActivityAt?: string
    createdAt: string
    updatedAt: string
}

// Tags component
function ContactTags({ tags }: { tags?: string[] }) {
    const t = useTranslations('crm.list')
    if (!tags || tags.length === 0) return <span className="text-muted-foreground">-</span>

    return (
        <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
                <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded"
                >
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                </span>
            ))}
            {tags.length > 3 && (
                <span className="text-xs text-muted-foreground">
                    {t('common.moreTags', { count: tags.length - 3 })}
                </span>
            )}
        </div>
    )
}

// Relative time component
function RelativeTime({ date }: { date?: string }) {
    const locale = useLocale()
    const t = useTranslations('crm.list')
    if (!date) return <span className="text-muted-foreground">{t('common.never')}</span>

    const past = new Date(date)
    const diffDays = Math.floor((Date.now() - past.getTime()) / (1000 * 60 * 60 * 24))
    const text = diffDays < 30 ? formatLocaleRelative(past, locale) : formatLocaleDate(past, locale)

    return (
        <div className={cn(
            'flex items-center gap-1.5 text-sm',
            diffDays > 30 ? 'text-muted-foreground' : 'text-foreground'
        )}>
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{text}</span>
        </div>
    )
}

export default function ContactsPage() {
    const t = useTranslations('crm.list')
    const locale = useLocale()
    const router = useRouter()
    const { currentTeam, isLoading: teamLoading } = useTeamContext()
    const [contacts, setContacts] = useState<Contact[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Permission checks for bulk actions
    const canDeleteContacts = usePermission('contacts.delete')

    useEffect(() => {
        if (teamLoading || !currentTeam) return

        async function fetchContacts() {
            try {
                const response = await fetchWithTeam('/api/v1/contacts')
                if (!response.ok) throw new Error('Failed to fetch contacts')
                const result = await response.json()
                // the API sends the id of the company, not its name
                const companies = await fetchRows<{ id: string; name?: string }>('/api/v1/companies')
                setContacts(withCompanyName<Contact>(result.data || [], companies))
            } catch (error) {
                console.error('Error loading contacts:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchContacts()
    }, [teamLoading, currentTeam])

    // Stats
    const stats = useMemo(() => {
        const withCompany = contacts.filter(c => c.companyId || c.companyName).length
        const recentlyActive = contacts.filter(c => {
            if (!c.lastActivityAt) return false
            const days = Math.floor((Date.now() - new Date(c.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24))
            return days <= 30
        }).length

        return {
            total: contacts.length,
            withCompany,
            recentlyActive,
            withEmail: contacts.filter(c => c.email).length,
        }
    }, [contacts])

    // Column definitions
    const columns: Column<Contact>[] = [
        {
            key: 'name',
            header: t('contacts.columns.name'),
            sortable: true,
            render: (_, contact) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {contact.firstName?.[0]?.toUpperCase()}{contact.lastName?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <p className="font-medium text-foreground">
                            {contact.firstName} {contact.lastName}
                        </p>
                        {contact.title && (
                            <p className="text-xs text-muted-foreground">{contact.title}</p>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'contact',
            header: t('contacts.columns.contactInfo'),
            render: (_, contact) => (
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[180px]">{contact.email}</span>
                    </div>
                    {contact.phone && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{contact.phone}</span>
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'companyName',
            header: t('contacts.columns.company'),
            sortable: true,
            render: (value, contact) => value ? (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        if (contact.companyId) {
                            router.push(`/dashboard/companies/${contact.companyId}`)
                        }
                    }}
                    className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
                >
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className={contact.companyId ? 'hover:underline' : ''}>{value}</span>
                </button>
            ) : <span className="text-muted-foreground">-</span>,
        },
        {
            key: 'tags',
            header: t('contacts.columns.tags'),
            render: (value) => <ContactTags tags={value} />,
        },
        {
            key: 'lastActivityAt',
            header: t('contacts.columns.lastActivity'),
            sortable: true,
            render: (value) => <RelativeTime date={value} />,
        },
    ]

    // Bulk actions - filtered by permissions
    const bulkActions: BulkAction[] = [
        {
            id: 'email',
            label: t('contacts.sendEmail'),
            icon: <Send className="w-4 h-4" />,
            onClick: (ids) => {
                console.log('Send email to:', ids)
                // Implement email logic
            },
        },
        {
            id: 'export',
            label: t('common.export'),
            icon: <Download className="w-4 h-4" />,
            onClick: (ids) => {
                console.log('Export contacts:', ids)
                // Implement export logic
            },
        },
        // Only show delete action if user has permission
        ...(canDeleteContacts ? [{
            id: 'delete',
            label: t('common.delete'),
            icon: <Trash2 className="w-4 h-4" />,
            variant: 'destructive' as const,
            onClick: async (ids: string[]) => {
                if (confirm(t('contacts.deleteConfirm', { count: ids.length }))) {
                    console.log('Delete contacts:', ids)
                    // Implement delete logic
                }
            },
        }] : []),
    ]

    const handleRowClick = (contact: Contact) => {
        router.push(`/dashboard/contacts/${contact.id}`)
    }

    const handleAddContact = () => {
        router.push('/dashboard/contacts/create')
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                        {t('contacts.title')}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {t('contacts.subtitle')}
                    </p>
                </div>
                <Button onClick={handleAddContact} className="gap-2" data-cy="contacts-add">
                    <Plus className="w-4 h-4" />
                    {t('contacts.add')}
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{formatLocaleNumber(stats.total, locale)}</p>
                            <p className="text-xs text-muted-foreground">{t('contacts.stats.total')}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{formatLocaleNumber(stats.withCompany, locale)}</p>
                            <p className="text-xs text-muted-foreground">{t('contacts.stats.withCompany')}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{formatLocaleNumber(stats.recentlyActive, locale)}</p>
                            <p className="text-xs text-muted-foreground">{t('contacts.stats.recentlyActive')}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Mail className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{formatLocaleNumber(stats.withEmail, locale)}</p>
                            <p className="text-xs text-muted-foreground">{t('contacts.stats.withEmail')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <CRMDataTable
                data={contacts}
                columns={columns}
                bulkActions={bulkActions}
                onRowClick={handleRowClick}
                isLoading={isLoading}
                searchPlaceholder={t('contacts.search')}
                searchFields={['firstName', 'lastName', 'email', 'companyName']}
                pageSize={15}
                emptyMessage={t('contacts.empty')}
                emptyDescription={t('contacts.emptyDescription')}
                entitySlug="contacts"
            />
        </div>
    )
}
