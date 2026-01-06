/**
 * Stages Repeater Component
 * Custom repeater field for managing pipeline stages
 */

'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Input } from '@nextsparkjs/core/components/ui/input'
import { Label } from '@nextsparkjs/core/components/ui/label'
import {
    Plus,
    Trash2,
    GripVertical,
    ChevronUp,
    ChevronDown,
    Palette
} from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'

export interface Stage {
    id: string
    name: string
    order: number
    probability: number
    color: string
}

interface StagesRepeaterProps {
    value: Stage[]
    onChange: (stages: Stage[]) => void
    disabled?: boolean
}

// Predefined colors for stages
const STAGE_COLORS = [
    { value: '#6366f1', label: 'Indigo' },
    { value: '#8b5cf6', label: 'Violet' },
    { value: '#a855f7', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#f43f5e', label: 'Rose' },
    { value: '#ef4444', label: 'Red' },
    { value: '#f97316', label: 'Orange' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#eab308', label: 'Yellow' },
    { value: '#84cc16', label: 'Lime' },
    { value: '#22c55e', label: 'Green' },
    { value: '#10b981', label: 'Emerald' },
    { value: '#14b8a6', label: 'Teal' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#0ea5e9', label: 'Sky' },
    { value: '#3b82f6', label: 'Blue' },
]

// Default stages for new pipelines
export const DEFAULT_STAGES: Stage[] = [
    { id: crypto.randomUUID(), name: 'Lead', order: 0, probability: 10, color: '#6366f1' },
    { id: crypto.randomUUID(), name: 'Qualified', order: 1, probability: 25, color: '#8b5cf6' },
    { id: crypto.randomUUID(), name: 'Proposal', order: 2, probability: 50, color: '#f59e0b' },
    { id: crypto.randomUUID(), name: 'Negotiation', order: 3, probability: 75, color: '#f97316' },
    { id: crypto.randomUUID(), name: 'Closed Won', order: 4, probability: 100, color: '#22c55e' },
]

export function StagesRepeater({ value, onChange, disabled = false }: StagesRepeaterProps) {
    const [expandedColorPicker, setExpandedColorPicker] = useState<string | null>(null)

    const addStage = useCallback(() => {
        const newStage: Stage = {
            id: crypto.randomUUID(),
            name: '',
            order: value.length,
            probability: 50,
            color: STAGE_COLORS[value.length % STAGE_COLORS.length].value,
        }
        onChange([...value, newStage])
    }, [value, onChange])

    const removeStage = useCallback((id: string) => {
        const filtered = value.filter(s => s.id !== id)
        // Recalculate order
        const reordered = filtered.map((s, idx) => ({ ...s, order: idx }))
        onChange(reordered)
    }, [value, onChange])

    const updateStage = useCallback((id: string, updates: Partial<Stage>) => {
        onChange(value.map(s => s.id === id ? { ...s, ...updates } : s))
    }, [value, onChange])

    const moveStage = useCallback((id: string, direction: 'up' | 'down') => {
        const index = value.findIndex(s => s.id === id)
        if (index === -1) return
        if (direction === 'up' && index === 0) return
        if (direction === 'down' && index === value.length - 1) return

        const newStages = [...value]
        const swapIndex = direction === 'up' ? index - 1 : index + 1

        // Swap items
        ;[newStages[index], newStages[swapIndex]] = [newStages[swapIndex], newStages[index]]

        // Update order values
        const reordered = newStages.map((s, idx) => ({ ...s, order: idx }))
        onChange(reordered)
    }, [value, onChange])

    return (
        <div className="space-y-4" data-cy="stages-repeater">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Pipeline Stages</Label>
                <span className="text-xs text-muted-foreground" data-cy="stages-repeater-count">
                    {value.length} stage{value.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Stages List */}
            <div className="space-y-2" data-cy="stages-repeater-list">
                {value.map((stage, index) => (
                    <div
                        key={stage.id}
                        data-cy={`stages-repeater-item-${stage.id}`}
                        className={cn(
                            'group relative bg-card border rounded-xl p-4 transition-all',
                            'hover:border-primary/30 hover:shadow-sm',
                            disabled && 'opacity-60 pointer-events-none'
                        )}
                    >
                        {/* Color indicator */}
                        <div
                            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                            style={{ backgroundColor: stage.color }}
                        />

                        <div className="flex items-start gap-3 pl-2">
                            {/* Drag handle / Order controls */}
                            <div className="flex flex-col items-center gap-0.5 pt-1">
                                <button
                                    type="button"
                                    onClick={() => moveStage(stage.id, 'up')}
                                    disabled={index === 0 || disabled}
                                    className={cn(
                                        'p-0.5 rounded hover:bg-muted transition-colors',
                                        index === 0 && 'opacity-30 cursor-not-allowed'
                                    )}
                                >
                                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                </button>
                                <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                                <button
                                    type="button"
                                    onClick={() => moveStage(stage.id, 'down')}
                                    disabled={index === value.length - 1 || disabled}
                                    className={cn(
                                        'p-0.5 rounded hover:bg-muted transition-colors',
                                        index === value.length - 1 && 'opacity-30 cursor-not-allowed'
                                    )}
                                >
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                </button>
                            </div>

                            {/* Stage fields */}
                            <div className="flex-1 grid grid-cols-12 gap-3">
                                {/* Order badge */}
                                <div className="col-span-1 flex items-center justify-center">
                                    <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                        {index + 1}
                                    </span>
                                </div>

                                {/* Name */}
                                <div className="col-span-5">
                                    <Label className="text-xs text-muted-foreground mb-1 block">
                                        Stage Name
                                    </Label>
                                    <Input
                                        value={stage.name}
                                        onChange={(e) => updateStage(stage.id, { name: e.target.value })}
                                        placeholder="e.g., Qualified Lead"
                                        disabled={disabled}
                                        className="h-9"
                                        data-cy={`stages-repeater-name-${stage.id}`}
                                    />
                                </div>

                                {/* Probability */}
                                <div className="col-span-3">
                                    <Label className="text-xs text-muted-foreground mb-1 block">
                                        Win Probability
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={stage.probability}
                                            onChange={(e) => updateStage(stage.id, { probability: parseInt(e.target.value) || 0 })}
                                            disabled={disabled}
                                            className="h-9 pr-8"
                                            data-cy={`stages-repeater-probability-${stage.id}`}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                            %
                                        </span>
                                    </div>
                                </div>

                                {/* Color picker */}
                                <div className="col-span-2">
                                    <Label className="text-xs text-muted-foreground mb-1 block">
                                        Color
                                    </Label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setExpandedColorPicker(
                                                expandedColorPicker === stage.id ? null : stage.id
                                            )}
                                            disabled={disabled}
                                            className={cn(
                                                'w-full h-9 rounded-md border flex items-center gap-2 px-3 transition-colors',
                                                'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20'
                                            )}
                                        >
                                            <div
                                                className="w-4 h-4 rounded-full border"
                                                style={{ backgroundColor: stage.color }}
                                            />
                                            <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                                        </button>

                                        {/* Color picker dropdown */}
                                        {expandedColorPicker === stage.id && (
                                            <div className="absolute top-full left-0 mt-1 p-2 bg-popover border rounded-lg shadow-lg z-50 w-[200px]">
                                                <div className="grid grid-cols-4 gap-1.5">
                                                    {STAGE_COLORS.map((color) => (
                                                        <button
                                                            key={color.value}
                                                            type="button"
                                                            onClick={() => {
                                                                updateStage(stage.id, { color: color.value })
                                                                setExpandedColorPicker(null)
                                                            }}
                                                            className={cn(
                                                                'w-8 h-8 rounded-md border-2 transition-all hover:scale-110',
                                                                stage.color === color.value
                                                                    ? 'border-foreground scale-110'
                                                                    : 'border-transparent'
                                                            )}
                                                            style={{ backgroundColor: color.value }}
                                                            title={color.label}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Delete button */}
                                <div className="col-span-1 flex items-end justify-end">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeStage(stage.id)}
                                        disabled={disabled || value.length <= 1}
                                        className={cn(
                                            'h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10',
                                            value.length <= 1 && 'opacity-30 cursor-not-allowed'
                                        )}
                                        data-cy={`stages-repeater-delete-${stage.id}`}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Probability bar preview */}
                        <div className="mt-3 pl-10">
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                        width: `${stage.probability}%`,
                                        backgroundColor: stage.color
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add stage button */}
            <Button
                type="button"
                variant="outline"
                onClick={addStage}
                disabled={disabled}
                className="w-full border-dashed gap-2"
                data-cy="stages-repeater-add-btn"
            >
                <Plus className="w-4 h-4" />
                Add Stage
            </Button>

            {/* Help text */}
            <p className="text-xs text-muted-foreground">
                Stages represent the steps in your sales process. Set probability to reflect the likelihood of closing a deal at each stage.
            </p>
        </div>
    )
}

export default StagesRepeater
