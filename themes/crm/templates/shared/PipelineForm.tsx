/**
 * Pipeline Form Component
 * Custom form for creating/editing pipelines with stages repeater
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Input } from '@nextsparkjs/core/components/ui/input'
import { Label } from '@nextsparkjs/core/components/ui/label'
import { Textarea } from '@nextsparkjs/core/components/ui/textarea'
import { Switch } from '@nextsparkjs/core/components/ui/switch'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@nextsparkjs/core/components/ui/select'
import { StagesRepeater, DEFAULT_STAGES, type Stage } from './StagesRepeater'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { ArrowLeft, Save, Loader2, GitBranch } from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'

interface PipelineFormData {
    name: string
    description: string
    type: string
    isDefault: boolean
    isActive: boolean
    stages: Stage[]
    dealRottenDays: number
}

interface PipelineFormProps {
    mode: 'create' | 'edit'
    pipelineId?: string
    onSuccess?: (id?: string) => void
    onCancel?: () => void
}

const PIPELINE_TYPES = [
    { value: 'sales', label: 'Sales' },
    { value: 'support', label: 'Support' },
    { value: 'project', label: 'Project' },
    { value: 'custom', label: 'Custom' },
]

export function PipelineForm({ mode, pipelineId, onSuccess, onCancel }: PipelineFormProps) {
    const router = useRouter()
    const { currentTeam, isLoading: teamLoading } = useTeamContext()

    const [formData, setFormData] = useState<PipelineFormData>({
        name: '',
        description: '',
        type: 'sales',
        isDefault: false,
        isActive: true,
        stages: DEFAULT_STAGES,
        dealRottenDays: 30,
    })

    const [isLoading, setIsLoading] = useState(mode === 'edit')
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Load existing pipeline data for edit mode
    useEffect(() => {
        if (mode === 'edit' && pipelineId && !teamLoading && currentTeam) {
            loadPipeline()
        }
    }, [mode, pipelineId, teamLoading, currentTeam])

    const loadPipeline = async () => {
        try {
            const response = await fetchWithTeam(`/api/v1/pipelines/${pipelineId}`)
            if (!response.ok) throw new Error('Failed to load pipeline')

            const result = await response.json()
            const data = result.data

            setFormData({
                name: data.name || '',
                description: data.description || '',
                type: data.type || 'sales',
                isDefault: data.isDefault || false,
                isActive: data.isActive !== false,
                stages: data.stages || DEFAULT_STAGES,
                dealRottenDays: data.dealRottenDays || 30,
            })
        } catch (err) {
            console.error('Error loading pipeline:', err)
            setError('Failed to load pipeline data')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        // Validation
        if (!formData.name.trim()) {
            setError('Pipeline name is required')
            return
        }

        if (formData.stages.length === 0) {
            setError('At least one stage is required')
            return
        }

        const emptyStages = formData.stages.filter(s => !s.name.trim())
        if (emptyStages.length > 0) {
            setError('All stages must have a name')
            return
        }

        setIsSaving(true)

        try {
            const url = mode === 'create'
                ? '/api/v1/pipelines'
                : `/api/v1/pipelines/${pipelineId}`

            const method = mode === 'create' ? 'POST' : 'PATCH'

            const response = await fetchWithTeam(url, {
                method,
                body: JSON.stringify(formData),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to save pipeline')
            }

            const result = await response.json()
            const savedId = result.data?.id || pipelineId

            if (onSuccess) {
                onSuccess(savedId)
            } else {
                router.push(`/dashboard/pipelines/${savedId}`)
            }
        } catch (err) {
            console.error('Error saving pipeline:', err)
            setError(err instanceof Error ? err.message : 'Failed to save pipeline')
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        if (onCancel) {
            onCancel()
        } else {
            router.back()
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Loading pipeline...</p>
                </div>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto" data-cy="pipeline-form">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleCancel}
                    className="shrink-0"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <GitBranch className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">
                            {mode === 'create' ? 'Create Pipeline' : 'Edit Pipeline'}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {mode === 'create'
                                ? 'Set up a new sales pipeline with custom stages'
                                : 'Modify pipeline settings and stages'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Error message */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            {/* Basic Info Section */}
            <div className="bg-card border rounded-xl p-6 space-y-5">
                <h2 className="font-semibold text-base border-b pb-3 mb-4">Basic Information</h2>

                <div className="grid grid-cols-2 gap-5">
                    {/* Name */}
                    <div className="col-span-2 sm:col-span-1">
                        <Label htmlFor="name" className="text-sm font-medium">
                            Pipeline Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Enterprise Sales"
                            className="mt-1.5"
                            required
                            data-cy="pipeline-form-name"
                        />
                    </div>

                    {/* Type */}
                    <div className="col-span-2 sm:col-span-1">
                        <Label htmlFor="type" className="text-sm font-medium">
                            Pipeline Type
                        </Label>
                        <Select
                            value={formData.type}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                        >
                            <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                {PIPELINE_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Description */}
                    <div className="col-span-2">
                        <Label htmlFor="description" className="text-sm font-medium">
                            Description
                        </Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe the purpose of this pipeline..."
                            className="mt-1.5 min-h-[80px]"
                            data-cy="pipeline-form-description"
                        />
                    </div>

                    {/* Deal Rotten Days */}
                    <div className="col-span-2 sm:col-span-1">
                        <Label htmlFor="dealRottenDays" className="text-sm font-medium">
                            Deal Rotten Days
                        </Label>
                        <p className="text-xs text-muted-foreground mb-1.5">
                            Days without activity before a deal is marked as stale
                        </p>
                        <Input
                            id="dealRottenDays"
                            type="number"
                            min={1}
                            max={365}
                            value={formData.dealRottenDays}
                            onChange={(e) => setFormData(prev => ({ ...prev, dealRottenDays: parseInt(e.target.value) || 30 }))}
                            className="w-32"
                        />
                    </div>

                    {/* Toggles */}
                    <div className="col-span-2 sm:col-span-1 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label htmlFor="isActive" className="text-sm font-medium">
                                    Active
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Enable this pipeline for use
                                </p>
                            </div>
                            <Switch
                                id="isActive"
                                checked={formData.isActive}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <Label htmlFor="isDefault" className="text-sm font-medium">
                                    Default Pipeline
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Use as default for new deals
                                </p>
                            </div>
                            <Switch
                                id="isDefault"
                                checked={formData.isDefault}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Stages Section */}
            <div className="bg-card border rounded-xl p-6">
                <h2 className="font-semibold text-base border-b pb-3 mb-4">Pipeline Stages</h2>
                <StagesRepeater
                    value={formData.stages}
                    onChange={(stages) => setFormData(prev => ({ ...prev, stages }))}
                    disabled={isSaving}
                />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSaving}
                    data-cy="pipeline-form-cancel"
                >
                    Cancel
                </Button>
                <Button type="submit" disabled={isSaving} className="gap-2" data-cy="pipeline-form-submit">
                    {isSaving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            {mode === 'create' ? 'Create Pipeline' : 'Save Changes'}
                        </>
                    )}
                </Button>
            </div>
        </form>
    )
}

export default PipelineForm
