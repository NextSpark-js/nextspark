/**
 * Contacts Page
 * Professional contacts management with data table and bulk actions
 */

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { CRMDataTable, type Column, type BulkAction } from '@/themes/crm/templates/shared/CRMDataTable'
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
                    +{tags.length - 3} more
                </span>
            )}
        </div>
    )
}

// Relative time component
function RelativeTime({ date }: { date?: string }) {
    if (!date) return <span className="text-muted-foreground">Never</span>

    const now = new Date()
    const past = new Date(date)
    const diffMs = now.getTime() - past.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    let text = ''
    if (diffDays === 0) {
        text = 'Today'
    } else if (diffDays === 1) {
        text = 'Yesterday'
    } else if (diffDays < 7) {
        text = `${diffDays} days ago`
    } else if (diffDays < 30) {
        text = `${Math.floor(diffDays / 7)} weeks ago`
    } else {
        text = past.toLocaleDateString()
    }

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
                setContacts(result.data || [])
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
            header: 'Name',
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
            header: 'Contact Info',
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
            header: 'Company',
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
            header: 'Tags',
            render: (value) => <ContactTags tags={value} />,
        },
        {
            key: 'lastActivityAt',
            header: 'Last Activity',
            sortable: true,
            render: (value) => <RelativeTime date={value} />,
        },
    ]

    // Bulk actions - filtered by permissions
    const bulkActions: BulkAction[] = [
        {
            id: 'email',
            label: 'Send Email',
            icon: <Send className="w-4 h-4" />,
            onClick: (ids) => {
                console.log('Send email to:', ids)
                // Implement email logic
            },
        },
        {
            id: 'export',
            label: 'Export',
            icon: <Download className="w-4 h-4" />,
            onClick: (ids) => {
                console.log('Export contacts:', ids)
                // Implement export logic
            },
        },
        // Only show delete action if user has permission
        ...(canDeleteContacts ? [{
            id: 'delete',
            label: 'Delete',
            icon: <Trash2 className="w-4 h-4" />,
            variant: 'destructive' as const,
            onClick: async (ids: string[]) => {
                if (confirm(`Delete ${ids.length} contact(s)?`)) {
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
                        Contacts
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage your business contacts and relationships
                    </p>
                </div>
                <Button onClick={handleAddContact} className="gap-2" data-cy="contacts-add">
                    <Plus className="w-4 h-4" />
                    Add Contact
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
                            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                            <p className="text-xs text-muted-foreground">Total Contacts</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.withCompany}</p>
                            <p className="text-xs text-muted-foreground">With Company</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.recentlyActive}</p>
                            <p className="text-xs text-muted-foreground">Recently Active</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Mail className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.withEmail}</p>
                            <p className="text-xs text-muted-foreground">With Email</p>
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
                searchPlaceholder="Search contacts..."
                searchFields={['firstName', 'lastName', 'email', 'companyName']}
                pageSize={15}
                emptyMessage="No contacts yet"
                emptyDescription="Start adding contacts to build your network."
                entitySlug="contacts"
            />
        </div>
    )
}
