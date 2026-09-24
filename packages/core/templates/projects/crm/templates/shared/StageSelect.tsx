/**
 * Stage Select Component
 * Dynamic select for pipeline stages based on selected pipeline
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@nextsparkjs/core/components/ui/select'
import { Label } from '@nextsparkjs/core/components/ui/label'
import { Loader2 } from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'

interface Stage {
    id: string
    name: string
    order: number
    probability: number
    color: string
}

interface StageSelectProps {
    value?: string
    onChange: (stageId: string, stage?: Stage) => void
    pipelineId?: string
    disabled?: boolean
    placeholder?: string
    label?: string
    required?: boolean
    className?: string
    dataCy?: string
}

export function StageSelect({
    value,
    onChange,
    pipelineId,
    disabled = false,
    placeholder = 'Select stage...',
    label,
    required = false,
    className,
    dataCy,
}: StageSelectProps) {
    const [stages, setStages] = useState<Stage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Fetch stages when pipelineId changes
    const fetchStages = useCallback(async (id: string) => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await fetchWithTeam(`/api/v1/pipelines/${id}`)
            if (!response.ok) {
                throw new Error('Failed to fetch pipeline')
            }

            const result = await response.json()
            const pipeline = result.data

            if (pipeline?.stages && Array.isArray(pipeline.stages)) {
                // Sort stages by order
                const sortedStages = [...pipeline.stages].sort((a, b) => a.order - b.order)
                setStages(sortedStages)
            } else {
                setStages([])
            }
        } catch (err) {
            console.error('Error fetching pipeline stages:', err)
            setError('Failed to load stages')
            setStages([])
        } finally {
            setIsLoading(false)
        }
    }, [])

    // Watch for pipelineId changes
    useEffect(() => {
        if (pipelineId) {
            fetchStages(pipelineId)
        } else {
            setStages([])
            // Clear value when pipeline is deselected
            if (value) {
                onChange('')
            }
        }
    }, [pipelineId, fetchStages])

    // When stages change, check if current value is still valid
    useEffect(() => {
        if (value && stages.length > 0) {
            const stageExists = stages.some(s => s.id === value)
            if (!stageExists) {
                // Current value is not in the new stages list, clear it
                onChange('')
            }
        }
    }, [stages, value, onChange])

    const handleChange = (stageId: string) => {
        const selectedStage = stages.find(s => s.id === stageId)
        onChange(stageId, selectedStage)
    }

    const isDisabled = disabled || !pipelineId || isLoading

    return (
        <div className={cn('space-y-1.5', className)} data-cy={dataCy}>
            {label && (
                <Label className="text-sm font-medium">
                    {label} {required && <span className="text-destructive">*</span>}
                </Label>
            )}

            <Select
                value={value || ''}
                onValueChange={handleChange}
                disabled={isDisabled}
            >
                <SelectTrigger className={cn(isLoading && 'opacity-70')}>
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-muted-foreground">Loading stages...</span>
                        </div>
                    ) : (
                        <SelectValue placeholder={
                            !pipelineId
                                ? 'Select pipeline first'
                                : error
                                    ? 'Error loading stages'
                                    : placeholder
                        } />
                    )}
                </SelectTrigger>
                <SelectContent>
                    {stages.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                            {error || 'No stages available'}
                        </div>
                    ) : (
                        stages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: stage.color }}
                                    />
                                    <span>{stage.name}</span>
                                    <span className="text-xs text-muted-foreground ml-auto">
                                        {stage.probability}%
                                    </span>
                                </div>
                            </SelectItem>
                        ))
                    )}
                </SelectContent>
            </Select>

            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}
        </div>
    )
}

export default StageSelect
