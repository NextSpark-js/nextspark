/**
 * Product Create Page
 * Form for creating new products - Owner only
 */

'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { EntityFormWrapper } from '@nextsparkjs/core/components/entities/wrappers/EntityFormWrapper'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { usePermission } from '@nextsparkjs/core/lib/permissions/hooks'
import { ShieldAlert, ArrowLeft } from 'lucide-react'

// Access Denied component for when user doesn't have permission
function AccessDeniedView({
    title = 'Access Denied',
    message = "You don't have permission to perform this action",
    backUrl = '/dashboard/products'
}: {
    title?: string
    message?: string
    backUrl?: string
}) {
    const router = useRouter()

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
            <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">{title}</h2>
                <p className="text-sm text-muted-foreground max-w-md">{message}</p>
            </div>
            <Button variant="outline" onClick={() => router.push(backUrl)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Products
            </Button>
        </div>
    )
}

export default function ProductCreatePage() {
    const router = useRouter()
    const { currentTeam, isLoading: teamLoading } = useTeamContext()
    const [permissionChecked, setPermissionChecked] = useState(false)

    // Permission check - only owner can create products
    const canCreate = usePermission('products.create')

    // Wait for team context to load before checking permissions
    useEffect(() => {
        if (!teamLoading && currentTeam) {
            setPermissionChecked(true)
        }
    }, [teamLoading, currentTeam])

    // Loading state while checking permissions
    if (!permissionChecked) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        )
    }

    // Permission denied - show access denied page
    if (!canCreate) {
        return (
            <AccessDeniedView
                title="Cannot Create Product"
                message="Only the team owner can create new products in the catalog. Please contact your team owner if you need to add a product."
            />
        )
    }

    // Has permission - show the form
    return (
        <EntityFormWrapper
            entityType="products"
            mode="create"
            onSuccess={(createdId) => {
                if (createdId) {
                    router.push(`/dashboard/products/${createdId}`)
                } else {
                    router.push('/dashboard/products')
                }
            }}
            onError={(error) => {
                console.error('Error creating product:', error)
            }}
        />
    )
}
