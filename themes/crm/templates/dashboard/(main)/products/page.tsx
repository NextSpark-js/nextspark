/**
 * Products Page
 * Professional products catalog management with data table
 */

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { CRMDataTable, type Column, type BulkAction } from '@/themes/crm/templates/shared/CRMDataTable'
import {
    Plus,
    Package,
    Trash2,
    Download,
    DollarSign,
    Tag,
    Archive,
    TrendingUp,
    Percent
} from 'lucide-react'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { cn } from '@nextsparkjs/core/lib/utils'
import { PermissionGate } from '@nextsparkjs/core/components/permissions/PermissionGate'
import { usePermission } from '@nextsparkjs/core/lib/permissions/hooks'

interface Product {
    id: string
    name: string
    description?: string
    sku?: string
    category?: string
    price: number
    cost?: number
    status: 'active' | 'inactive' | 'discontinued'
    stock?: number
    salesCount?: number
    createdAt: string
}

// Status badge component
function StatusBadge({ status }: { status: Product['status'] }) {
    const config = {
        active: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-600' },
        inactive: { label: 'Inactive', className: 'bg-amber-500/10 text-amber-600' },
        discontinued: { label: 'Discontinued', className: 'bg-muted text-muted-foreground' },
    }

    const { label, className } = config[status] || config.active

    return (
        <span className={cn('px-2.5 py-1 rounded-md text-xs font-medium', className)}>
            {label}
        </span>
    )
}

// Margin indicator
function MarginIndicator({ price, cost }: { price: number; cost?: number }) {
    if (!cost || cost === 0) return <span className="text-muted-foreground">-</span>

    const margin = ((price - cost) / price) * 100

    let colorClass = 'text-muted-foreground'
    if (margin >= 50) colorClass = 'text-emerald-600'
    else if (margin >= 30) colorClass = 'text-amber-600'
    else if (margin >= 0) colorClass = 'text-orange-600'
    else colorClass = 'text-destructive'

    return (
        <div className={cn('flex items-center gap-1.5 text-sm font-medium', colorClass)}>
            <Percent className="w-3.5 h-3.5" />
            <span>{margin.toFixed(1)}%</span>
        </div>
    )
}

export default function ProductsPage() {
    const router = useRouter()
    const { currentTeam, isLoading: teamLoading } = useTeamContext()
    const [products, setProducts] = useState<Product[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Permission checks for bulk actions
    const canDeleteProducts = usePermission('products.delete')
    const canUpdateProducts = usePermission('products.update')

    useEffect(() => {
        if (teamLoading || !currentTeam) return

        async function fetchProducts() {
            try {
                const response = await fetchWithTeam('/api/v1/products')
                if (!response.ok) throw new Error('Failed to fetch products')
                const result = await response.json()
                setProducts(result.data || [])
            } catch (error) {
                console.error('Error loading products:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchProducts()
    }, [teamLoading, currentTeam])

    // Stats
    const stats = useMemo(() => {
        const active = products.filter(p => p.status === 'active').length
        const totalRevenue = products.reduce((sum, p) => sum + (p.price * (p.salesCount || 0)), 0)
        const avgPrice = products.length > 0
            ? products.reduce((sum, p) => sum + p.price, 0) / products.length
            : 0

        return {
            total: products.length,
            active,
            totalRevenue,
            avgPrice,
        }
    }, [products])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    // Column definitions
    const columns: Column<Product>[] = [
        {
            key: 'name',
            header: 'Product',
            sortable: true,
            render: (_, product) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <p className="font-medium text-foreground">{product.name}</p>
                        {product.sku && (
                            <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'category',
            header: 'Category',
            sortable: true,
            render: (value) => value ? (
                <div className="flex items-center gap-1.5 text-sm">
                    <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{value}</span>
                </div>
            ) : <span className="text-muted-foreground">-</span>,
        },
        {
            key: 'price',
            header: 'Price',
            sortable: true,
            render: (value) => (
                <span className="font-medium text-primary">
                    {formatCurrency(value)}
                </span>
            ),
        },
        {
            key: 'margin',
            header: 'Margin',
            render: (_, product) => (
                <MarginIndicator price={product.price} cost={product.cost} />
            ),
        },
        {
            key: 'salesCount',
            header: 'Sales',
            sortable: true,
            render: (value) => (
                <div className="flex items-center gap-1.5 text-sm">
                    <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{value || 0}</span>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (value) => <StatusBadge status={value} />,
        },
    ]

    // Bulk actions - filtered by permissions
    const bulkActions: BulkAction[] = [
        {
            id: 'export',
            label: 'Export',
            icon: <Download className="w-4 h-4" />,
            onClick: (ids) => console.log('Export:', ids),
        },
        // Only show archive action if user has update permission
        ...(canUpdateProducts ? [{
            id: 'archive',
            label: 'Archive',
            icon: <Archive className="w-4 h-4" />,
            onClick: (ids: string[]) => { if (confirm(`Archive ${ids.length} products?`)) console.log('Archive:', ids) },
        }] : []),
        // Only show delete action if user has permission
        ...(canDeleteProducts ? [{
            id: 'delete',
            label: 'Delete',
            icon: <Trash2 className="w-4 h-4" />,
            variant: 'destructive' as const,
            onClick: (ids: string[]) => { if (confirm(`Delete ${ids.length} products?`)) console.log('Delete:', ids) },
        }] : []),
    ]

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Products</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage your product catalog and pricing
                    </p>
                </div>
                <PermissionGate permission="products.create">
                    <Button onClick={() => router.push('/dashboard/products/create')} className="gap-2" data-cy="products-add">
                        <Plus className="w-4 h-4" />
                        Add Product
                    </Button>
                </PermissionGate>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Package className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                            <p className="text-xs text-muted-foreground">Products</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                            <p className="text-xs text-muted-foreground">Active</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalRevenue)}</p>
                            <p className="text-xs text-muted-foreground">Total Revenue</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Tag className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.avgPrice)}</p>
                            <p className="text-xs text-muted-foreground">Avg. Price</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <CRMDataTable
                data={products}
                columns={columns}
                bulkActions={bulkActions}
                onRowClick={(p) => router.push(`/dashboard/products/${p.id}`)}
                isLoading={isLoading}
                searchPlaceholder="Search products..."
                searchFields={['name', 'sku', 'category']}
                pageSize={15}
                emptyMessage="No products yet"
                emptyDescription="Start adding products to build your catalog."
                entitySlug="products"
            />
        </div>
    )
}
