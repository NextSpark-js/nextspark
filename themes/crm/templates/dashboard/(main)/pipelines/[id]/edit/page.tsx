/**
 * Pipeline Edit Page
 * Form for editing existing pipelines - Owner only
 */

'use client'

import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { PipelineForm } from '@/themes/crm/templates/shared/PipelineForm'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { usePermission } from '@nextsparkjs/core/lib/permissions/hooks'
import { ShieldAlert, ArrowLeft } from 'lucide-react'

// Access Denied component for when user doesn't have permission
function AccessDeniedView({
    title = 'Access Denied',
    message = "You don't have permission to perform this action",
    backUrl = '/dashboard/pipelines'
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
                Back to Pipelines
            </Button>
        </div>
    )
}

export default function PipelineEditPage() {
    const router = useRouter()
    const params = useParams()
    const pipelineId = params.id as string

    const { currentTeam, isLoading: teamLoading } = useTeamContext()
    const [permissionChecked, setPermissionChecked] = useState(false)

    // Permission check - only owner can update pipelines
    const canUpdate = usePermission('pipelines.update')

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
    if (!canUpdate) {
        return (
            <AccessDeniedView
                title="Cannot Edit Pipeline"
                message="Only the team owner can edit sales pipelines. Please contact your team owner if you need to make changes."
                backUrl={`/dashboard/pipelines/${pipelineId}`}
            />
        )
    }

    // Has permission - show the custom form
    return (
        <div className="p-6">
            <PipelineForm
                mode="edit"
                pipelineId={pipelineId}
                onSuccess={() => {
                    router.push(`/dashboard/pipelines/${pipelineId}`)
                }}
            />
        </div>
    )
}
