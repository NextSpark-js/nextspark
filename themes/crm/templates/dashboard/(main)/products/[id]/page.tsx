/**
 * Product Detail Page
 * Professional product detail view with CRM-style metrics and layout
 */

'use client'

import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import {
    ArrowLeft,
    Package,
    Edit,
    Trash2,
    DollarSign,
    Percent,
    Calculator,
    ExternalLink,
    FileText,
    Image as ImageIcon,
    CheckCircle,
    XCircle,
    Clock,
    Tag,
    Hash,
    Layers,
    Scale,
    Users,
    Calendar
} from 'lucide-react'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { usePermission } from '@nextsparkjs/core/lib/permissions/hooks'
import { cn } from '@nextsparkjs/core/lib/utils'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@nextsparkjs/core/components/ui/alert-dialog'

interface Product {
    id: string
    code: string
    name: string
    category?: string
    type?: 'product' | 'service' | 'subscription' | 'bundle' | 'addon'
    description?: string
    price: number
    cost?: number
    currency?: string
    unit?: string
    isActive?: boolean
    minimumQuantity?: number
    image?: string
    brochureUrl?: string
    commissionRate?: number
    createdAt: string
    updatedAt?: string
}

// Type badge component
function TypeBadge({ type }: { type?: Product['type'] }) {
    const config = {
        product: { label: 'Product', className: 'bg-primary/10 text-primary' },
        service: { label: 'Service', className: 'bg-violet-500/10 text-violet-600' },
        subscription: { label: 'Subscription', className: 'bg-amber-500/10 text-amber-600' },
        bundle: { label: 'Bundle', className: 'bg-emerald-500/10 text-emerald-600' },
        addon: { label: 'Add-on', className: 'bg-sky-500/10 text-sky-600' },
    }

    const { label, className } = config[type || 'product'] || config.product

    return (
        <span className={cn('px-2.5 py-1 rounded-md text-xs font-medium', className)}>
            {label}
        </span>
    )
}

// Status badge component
function StatusBadge({ isActive }: { isActive?: boolean }) {
    return isActive ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-600">
            <CheckCircle className="w-3 h-3" />
            Active
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">
            <XCircle className="w-3 h-3" />
            Inactive
        </span>
    )
}

// Metric card component
function MetricCard({
    icon: Icon,
    label,
    value,
    subValue,
    iconColor = 'text-primary',
    iconBg = 'bg-primary/10'
}: {
    icon: React.ElementType
    label: string
    value: string
    subValue?: string
    iconColor?: string
    iconBg?: string
}) {
    return (
        <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconBg)}>
                    <Icon className={cn('w-5 h-5', iconColor)} />
                </div>
                <div>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    {subValue && (
                        <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>
                    )}
                </div>
            </div>
        </div>
    )
}

// Detail item component
function DetailItem({
    icon: Icon,
    label,
    value
}: {
    icon: React.ElementType
    label: string
    value: React.ReactNode
}) {
    return (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Icon className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{value || '-'}</p>
            </div>
        </div>
    )
}

export default function ProductDetailPage() {
    const router = useRouter()
    const params = useParams()
    const productId = params.id as string

    const { currentTeam, isLoading: teamLoading } = useTeamContext()
    const [product, setProduct] = useState<Product | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isDeleting, setIsDeleting] = useState(false)

    // Permission checks
    const canUpdate = usePermission('products.update')
    const canDelete = usePermission('products.delete')

    useEffect(() => {
        if (teamLoading || !currentTeam || !productId) return

        async function fetchProduct() {
            try {
                const response = await fetchWithTeam(`/api/v1/products/${productId}`)
                if (!response.ok) throw new Error('Failed to fetch product')
                const result = await response.json()
                setProduct(result.data || result)
            } catch (error) {
                console.error('Error loading product:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchProduct()
    }, [teamLoading, currentTeam, productId])

    // Calculate margin
    const margin = useMemo(() => {
        if (!product?.price || !product?.cost || product.cost === 0) return null
        return ((product.price - product.cost) / product.price) * 100
    }, [product])

    // Currency formatter
    const formatCurrency = (value: number, currency: string = 'USD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD', // Handle null case
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value)
    }

    // Unit label mapper
    const getUnitLabel = (unit?: string) => {
        const units: Record<string, string> = {
            piece: 'Piece',
            hour: 'Hour',
            day: 'Day',
            week: 'Week',
            month: 'Month',
            year: 'Year',
            kg: 'Kilogram',
            lb: 'Pound',
            meter: 'Meter',
            foot: 'Foot',
            license: 'License',
            user: 'User',
        }
        return units[unit || ''] || unit || '-'
    }

    // Handle delete
    const handleDelete = async () => {
        if (!product) return

        setIsDeleting(true)
        try {
            const response = await fetchWithTeam(`/api/v1/products/${product.id}`, {
                method: 'DELETE',
            })

            if (!response.ok) throw new Error('Failed to delete product')

            router.push('/dashboard/products')
        } catch (error) {
            console.error('Error deleting product:', error)
            setIsDeleting(false)
        }
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        )
    }

    // Not found state
    if (!product) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-6">
                <Package className="w-12 h-12 text-muted-foreground" />
                <div className="text-center">
                    <h2 className="text-xl font-semibold">Product Not Found</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        The product you&apos;re looking for doesn&apos;t exist or has been deleted.
                    </p>
                </div>
                <Button variant="outline" onClick={() => router.push('/dashboard/products')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Products
                </Button>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push('/dashboard/products')}
                        className="shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-foreground tracking-tight">
                                {product.name}
                            </h1>
                            <StatusBadge isActive={product.isActive} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Hash className="w-3.5 h-3.5" />
                                {product.code}
                            </span>
                            {product.category && (
                                <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <Tag className="w-3.5 h-3.5" />
                                        {product.category}
                                    </span>
                                </>
                            )}
                            <span>•</span>
                            <TypeBadge type={product.type} />
                        </div>
                    </div>
                </div>

                {/* Action buttons - Only for owner */}
                <div className="flex items-center gap-2 sm:shrink-0">
                    {canUpdate && (
                        <Button
                            variant="outline"
                            onClick={() => router.push(`/dashboard/products/${product.id}/edit`)}
                            className="gap-2"
                        >
                            <Edit className="w-4 h-4" />
                            Edit
                        </Button>
                    )}
                    {canDelete && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="gap-2">
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Product</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to delete &quot;{product.name}&quot;? This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        {isDeleting ? 'Deleting...' : 'Delete'}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                    icon={DollarSign}
                    label="Price"
                    value={formatCurrency(product.price, product.currency)}
                    subValue={product.unit ? `per ${getUnitLabel(product.unit)}` : undefined}
                    iconColor="text-primary"
                    iconBg="bg-primary/10"
                />
                <MetricCard
                    icon={Calculator}
                    label="Cost"
                    value={product.cost ? formatCurrency(product.cost, product.currency) : '-'}
                    iconColor="text-amber-600"
                    iconBg="bg-amber-500/10"
                />
                <MetricCard
                    icon={Percent}
                    label="Margin"
                    value={margin !== null ? `${margin.toFixed(1)}%` : '-'}
                    iconColor={margin && margin >= 50 ? 'text-emerald-600' : margin && margin >= 30 ? 'text-amber-600' : 'text-muted-foreground'}
                    iconBg={margin && margin >= 50 ? 'bg-emerald-500/10' : margin && margin >= 30 ? 'bg-amber-500/10' : 'bg-muted'}
                />
                <MetricCard
                    icon={Users}
                    label="Commission"
                    value={product.commissionRate ? `${product.commissionRate}%` : '-'}
                    iconColor="text-violet-600"
                    iconBg="bg-violet-500/10"
                />
            </div>

            {/* Product Details */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        Product Details
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <DetailItem
                            icon={Tag}
                            label="Type"
                            value={<TypeBadge type={product.type} />}
                        />
                        <DetailItem
                            icon={DollarSign}
                            label="Currency"
                            value={product.currency || 'USD'}
                        />
                        <DetailItem
                            icon={Scale}
                            label="Unit of Measure"
                            value={getUnitLabel(product.unit)}
                        />
                        <DetailItem
                            icon={Hash}
                            label="Minimum Quantity"
                            value={product.minimumQuantity?.toString() || '1'}
                        />
                        <DetailItem
                            icon={CheckCircle}
                            label="Status"
                            value={<StatusBadge isActive={product.isActive} />}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Description */}
            {product.description && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Description
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {product.description}
                        </p>
                    </CardContent>
                </Card>
            )}


            {/* Resources */}
            {(product.image || product.brochureUrl) && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" />
                            Resources
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-4">
                            {product.image && (
                                <a
                                    href={product.image}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-sm"
                                >
                                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                                    View Image
                                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                </a>
                            )}
                            {product.brochureUrl && (
                                <a
                                    href={product.brochureUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-sm"
                                >
                                    <FileText className="w-4 h-4 text-muted-foreground" />
                                    Download Brochure
                                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                </a>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Timestamps */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-4 border-t">
                <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Created: {new Date(product.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                    })}
                </div>
                {product.updatedAt && (
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Updated: {new Date(product.updatedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
