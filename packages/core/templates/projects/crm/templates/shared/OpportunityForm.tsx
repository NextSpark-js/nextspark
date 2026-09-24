/**
 * Opportunity Form Component
 * Custom form for creating/editing opportunities with dynamic stage selection
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Input } from '@nextsparkjs/core/components/ui/input'
import { Label } from '@nextsparkjs/core/components/ui/label'
import { Textarea } from '@nextsparkjs/core/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@nextsparkjs/core/components/ui/select'
import { SimpleRelationSelect } from '@nextsparkjs/core/components/ui/simple-relation-select'
import { UserSelect } from '@nextsparkjs/core/components/ui/user-select'
import { StageSelect } from './StageSelect'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { ArrowLeft, Save, Loader2, TrendingUp } from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'

interface OpportunityFormData {
    name: string
    companyId: string
    contactId: string
    pipelineId: string
    stageId: string
    amount: number
    currency: string
    probability: number
    closeDate: string
    type: string
    source: string
    competitor: string
    status: string
    lostReason: string
    assignedTo: string
}

interface OpportunityFormProps {
    mode: 'create' | 'edit'
    opportunityId?: string
    onSuccess?: (id?: string) => void
    onCancel?: () => void
}

const CURRENCIES = [
    { value: 'USD', label: 'US Dollar' },
    { value: 'EUR', label: 'Euro' },
    { value: 'GBP', label: 'British Pound' },
    { value: 'MXN', label: 'Mexican Peso' },
    { value: 'CAD', label: 'Canadian Dollar' },
]

const OPPORTUNITY_TYPES = [
    { value: 'new_business', label: 'New Business' },
    { value: 'existing_business', label: 'Existing Business' },
    { value: 'renewal', label: 'Renewal' },
    { value: 'upgrade', label: 'Upgrade' },
    { value: 'downgrade', label: 'Downgrade' },
]

const SOURCES = [
    { value: 'web', label: 'Website' },
    { value: 'referral', label: 'Referral' },
    { value: 'cold_call', label: 'Cold Call' },
    { value: 'trade_show', label: 'Trade Show' },
    { value: 'social_media', label: 'Social Media' },
    { value: 'email', label: 'Email' },
    { value: 'advertising', label: 'Advertising' },
    { value: 'partner', label: 'Partner' },
    { value: 'other', label: 'Other' },
]

const STATUSES = [
    { value: 'open', label: 'Open' },
    { value: 'won', label: 'Won' },
    { value: 'lost', label: 'Lost' },
    { value: 'abandoned', label: 'Abandoned' },
]

export function OpportunityForm({ mode, opportunityId, onSuccess, onCancel }: OpportunityFormProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { currentTeam, isLoading: teamLoading } = useTeamContext()

    // Get pipelineId from URL params if present (when coming from pipeline kanban)
    const initialPipelineId = searchParams.get('pipelineId') || ''

    const [formData, setFormData] = useState<OpportunityFormData>({
        name: '',
        companyId: '',
        contactId: '',
        pipelineId: initialPipelineId,
        stageId: '',
        amount: 0,
        currency: 'USD',
        probability: 0,
        closeDate: new Date().toISOString().split('T')[0],
        type: 'new_business',
        source: '',
        competitor: '',
        status: 'open',
        lostReason: '',
        assignedTo: '',
    })

    const [isLoading, setIsLoading] = useState(mode === 'edit')
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Load existing opportunity data for edit mode
    useEffect(() => {
        if (mode === 'edit' && opportunityId && !teamLoading && currentTeam) {
            loadOpportunity()
        }
    }, [mode, opportunityId, teamLoading, currentTeam])

    const loadOpportunity = async () => {
        try {
            const response = await fetchWithTeam(`/api/v1/opportunities/${opportunityId}`)
            if (!response.ok) throw new Error('Failed to load opportunity')

            const result = await response.json()
            const data = result.data

            setFormData({
                name: data.name || '',
                companyId: data.companyId || '',
                contactId: data.contactId || '',
                pipelineId: data.pipelineId || '',
                stageId: data.stageId || '',
                amount: data.amount || 0,
                currency: data.currency || 'USD',
                probability: data.probability || 0,
                closeDate: data.closeDate ? new Date(data.closeDate).toISOString().split('T')[0] : '',
                type: data.type || 'new_business',
                source: data.source || '',
                competitor: data.competitor || '',
                status: data.status || 'open',
                lostReason: data.lostReason || '',
                assignedTo: data.assignedTo || '',
            })
        } catch (err) {
            console.error('Error loading opportunity:', err)
            setError('Failed to load opportunity data')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        // Validation
        if (!formData.name.trim()) {
            setError('Opportunity name is required')
            return
        }

        if (!formData.companyId) {
            setError('Company is required')
            return
        }

        if (!formData.pipelineId) {
            setError('Pipeline is required')
            return
        }

        if (!formData.stageId) {
            setError('Stage is required')
            return
        }

        if (!formData.closeDate) {
            setError('Expected close date is required')
            return
        }

        setIsSaving(true)

        try {
            const url = mode === 'create'
                ? '/api/v1/opportunities'
                : `/api/v1/opportunities/${opportunityId}`

            const method = mode === 'create' ? 'POST' : 'PATCH'

            // Prepare data - only send non-empty values
            const submitData: Record<string, unknown> = {
                name: formData.name,
                companyId: formData.companyId,
                pipelineId: formData.pipelineId,
                stageId: formData.stageId,
                amount: formData.amount,
                currency: formData.currency,
                probability: formData.probability,
                closeDate: formData.closeDate,
                status: formData.status,
            }

            // Add optional fields only if they have values
            if (formData.contactId) submitData.contactId = formData.contactId
            if (formData.type) submitData.type = formData.type
            if (formData.source) submitData.source = formData.source
            if (formData.competitor) submitData.competitor = formData.competitor
            if (formData.lostReason) submitData.lostReason = formData.lostReason
            if (formData.assignedTo) submitData.assignedTo = formData.assignedTo

            const response = await fetchWithTeam(url, {
                method,
                body: JSON.stringify(submitData),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to save opportunity')
            }

            const result = await response.json()
            const savedId = result.data?.id || opportunityId

            if (onSuccess) {
                onSuccess(savedId)
            } else {
                router.push(`/dashboard/opportunities/${savedId}`)
            }
        } catch (err) {
            console.error('Error saving opportunity:', err)
            setError(err instanceof Error ? err.message : 'Failed to save opportunity')
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

    // Handle stage selection - auto-set probability from stage
    const handleStageChange = (stageId: string, stage?: { probability: number }) => {
        setFormData(prev => ({
            ...prev,
            stageId,
            // Auto-set probability from stage if available
            probability: stage?.probability ?? prev.probability,
        }))
    }

    // Handle pipeline change - clear stage when pipeline changes
    const handlePipelineChange = (pipelineId: string | string[] | null) => {
        const newPipelineId = Array.isArray(pipelineId) ? pipelineId[0] : (pipelineId || '')
        setFormData(prev => ({
            ...prev,
            pipelineId: newPipelineId,
            stageId: '', // Clear stage when pipeline changes
        }))
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Loading opportunity...</p>
                </div>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto" data-cy="opportunities-form">
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
                        <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">
                            {mode === 'create' ? 'Create Opportunity' : 'Edit Opportunity'}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {mode === 'create'
                                ? 'Add a new sales opportunity to your pipeline'
                                : 'Update opportunity details'}
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

                <div className="grid grid-cols-12 gap-5">
                    {/* Name */}
                    <div className="col-span-12 sm:col-span-6" data-cy="opportunities-field-name">
                        <Label htmlFor="name">
                            Opportunity Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Enterprise License Deal"
                            className="mt-1.5"
                            required
                        />
                    </div>

                    {/* Company */}
                    <div className="col-span-12 sm:col-span-6">
                        <Label>
                            Company <span className="text-destructive">*</span>
                        </Label>
                        <div className="mt-1.5">
                            <SimpleRelationSelect
                                value={formData.companyId}
                                onChange={(val) => setFormData(prev => ({
                                    ...prev,
                                    companyId: (Array.isArray(val) ? val[0] : val) || ''
                                }))}
                                entityType="companies"
                                titleField="name"
                                placeholder="Select company..."
                                disabled={isSaving}
                                teamId={currentTeam?.id}
                            />
                        </div>
                    </div>

                    {/* Contact */}
                    <div className="col-span-12 sm:col-span-6">
                        <Label>Primary Contact</Label>
                        <div className="mt-1.5">
                            <SimpleRelationSelect
                                value={formData.contactId}
                                onChange={(val) => setFormData(prev => ({
                                    ...prev,
                                    contactId: (Array.isArray(val) ? val[0] : val) || ''
                                }))}
                                entityType="contacts"
                                titleField="firstName"
                                placeholder="Select contact..."
                                disabled={isSaving}
                                teamId={currentTeam?.id}
                            />
                        </div>
                    </div>

                    {/* Assigned To */}
                    <div className="col-span-12 sm:col-span-6">
                        <Label>Assigned To</Label>
                        <div className="mt-1.5">
                            <UserSelect
                                value={formData.assignedTo ? [{ id: formData.assignedTo, firstName: '', email: '' }] : []}
                                onChange={(users) => {
                                    const userId = Array.isArray(users) && users.length > 0
                                        ? String(typeof users[0] === 'object' ? users[0].id : users[0])
                                        : ''
                                    setFormData(prev => ({ ...prev, assignedTo: userId }))
                                }}
                                disabled={isSaving}
                                multiple={false}
                                placeholder="Select user..."
                                teamId={currentTeam?.id}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Pipeline & Stage Section */}
            <div className="bg-card border rounded-xl p-6 space-y-5">
                <h2 className="font-semibold text-base border-b pb-3 mb-4">Pipeline & Stage</h2>

                <div className="grid grid-cols-12 gap-5">
                    {/* Pipeline */}
                    <div className="col-span-12 sm:col-span-6">
                        <Label>
                            Pipeline <span className="text-destructive">*</span>
                        </Label>
                        <div className="mt-1.5">
                            <SimpleRelationSelect
                                value={formData.pipelineId}
                                onChange={handlePipelineChange}
                                entityType="pipelines"
                                titleField="name"
                                placeholder="Select pipeline..."
                                disabled={isSaving}
                                teamId={currentTeam?.id}
                            />
                        </div>
                    </div>

                    {/* Stage */}
                    <div className="col-span-12 sm:col-span-6">
                        <StageSelect
                            label="Stage"
                            required
                            value={formData.stageId}
                            onChange={handleStageChange}
                            pipelineId={formData.pipelineId}
                            disabled={isSaving}
                            placeholder="Select stage..."
                            dataCy="opportunities-field-stage"
                        />
                    </div>

                    {/* Status */}
                    <div className="col-span-12 sm:col-span-4">
                        <Label>Status</Label>
                        <Select
                            value={formData.status}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                            disabled={isSaving}
                        >
                            <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUSES.map((status) => (
                                    <SelectItem key={status.value} value={status.value}>
                                        {status.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Lost Reason (shown only if status is lost) */}
                    {formData.status === 'lost' && (
                        <div className="col-span-12 sm:col-span-8">
                            <Label>Lost Reason</Label>
                            <Input
                                value={formData.lostReason}
                                onChange={(e) => setFormData(prev => ({ ...prev, lostReason: e.target.value }))}
                                placeholder="Why was this opportunity lost?"
                                className="mt-1.5"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Deal Value Section */}
            <div className="bg-card border rounded-xl p-6 space-y-5">
                <h2 className="font-semibold text-base border-b pb-3 mb-4">Deal Value</h2>

                <div className="grid grid-cols-12 gap-5">
                    {/* Amount */}
                    <div className="col-span-12 sm:col-span-4" data-cy="opportunities-field-value">
                        <Label htmlFor="amount">
                            Deal Amount <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="amount"
                            type="number"
                            min={0}
                            step={0.01}
                            value={formData.amount}
                            onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                            placeholder="0.00"
                            className="mt-1.5"
                            required
                        />
                    </div>

                    {/* Currency */}
                    <div className="col-span-12 sm:col-span-4">
                        <Label>Currency</Label>
                        <Select
                            value={formData.currency}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                            disabled={isSaving}
                        >
                            <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                            <SelectContent>
                                {CURRENCIES.map((currency) => (
                                    <SelectItem key={currency.value} value={currency.value}>
                                        {currency.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Probability */}
                    <div className="col-span-12 sm:col-span-4" data-cy="opportunities-field-probability">
                        <Label htmlFor="probability">Win Probability (%)</Label>
                        <div className="relative mt-1.5">
                            <Input
                                id="probability"
                                type="number"
                                min={0}
                                max={100}
                                value={formData.probability}
                                onChange={(e) => setFormData(prev => ({ ...prev, probability: parseInt(e.target.value) || 0 }))}
                                className="pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                %
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Auto-set from stage, can be adjusted
                        </p>
                    </div>

                    {/* Close Date */}
                    <div className="col-span-12 sm:col-span-4">
                        <Label htmlFor="closeDate">
                            Expected Close Date <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="closeDate"
                            type="date"
                            value={formData.closeDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, closeDate: e.target.value }))}
                            className="mt-1.5"
                            required
                        />
                    </div>
                </div>
            </div>

            {/* Additional Info Section */}
            <div className="bg-card border rounded-xl p-6 space-y-5">
                <h2 className="font-semibold text-base border-b pb-3 mb-4">Additional Information</h2>

                <div className="grid grid-cols-12 gap-5">
                    {/* Type */}
                    <div className="col-span-12 sm:col-span-4">
                        <Label>Opportunity Type</Label>
                        <Select
                            value={formData.type}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                            disabled={isSaving}
                        >
                            <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                {OPPORTUNITY_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Source */}
                    <div className="col-span-12 sm:col-span-4">
                        <Label>Source</Label>
                        <Select
                            value={formData.source}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, source: value }))}
                            disabled={isSaving}
                        >
                            <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                            <SelectContent>
                                {SOURCES.map((source) => (
                                    <SelectItem key={source.value} value={source.value}>
                                        {source.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Competitor */}
                    <div className="col-span-12 sm:col-span-4">
                        <Label htmlFor="competitor">Main Competitor</Label>
                        <Input
                            id="competitor"
                            value={formData.competitor}
                            onChange={(e) => setFormData(prev => ({ ...prev, competitor: e.target.value }))}
                            placeholder="Enter competitor name"
                            className="mt-1.5"
                        />
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSaving}
                    data-cy="opportunities-form-cancel"
                >
                    Cancel
                </Button>
                <Button type="submit" disabled={isSaving} className="gap-2" data-cy="opportunities-form-submit">
                    {isSaving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            {mode === 'create' ? 'Create Opportunity' : 'Save Changes'}
                        </>
                    )}
                </Button>
            </div>
        </form>
    )
}

export default OpportunityForm
