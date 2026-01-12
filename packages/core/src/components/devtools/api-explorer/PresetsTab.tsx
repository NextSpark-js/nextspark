'use client'

import { useState } from 'react'
import { Play, Eye, BookOpen } from 'lucide-react'
import { Button } from '../../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { Badge } from '../../ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '../../ui/dialog'
import { ScrollArea } from '../../ui/scroll-area'
import { sel } from '../../../lib/test'
import type { ApiEndpointPresets, ApiPreset } from '../../../types/api-presets'
import type { HttpMethod } from '../api-tester/types'

interface PresetsTabProps {
  endpointPresets: ApiEndpointPresets | null
  currentMethod: HttpMethod
  onApplyPreset: (preset: ApiPreset) => void
}

export function PresetsTab({ endpointPresets, currentMethod, onApplyPreset }: PresetsTabProps) {
  const [selectedPreset, setSelectedPreset] = useState<ApiPreset | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  if (!endpointPresets || endpointPresets.presets.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground"
        data-cy={sel('devtools.apiExplorer.presets.empty')}
      >
        <BookOpen className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">No presets available for this endpoint</p>
        <p className="text-xs mt-2">
          Create presets in <code className="bg-muted px-1 rounded">devtools/api/</code>
        </p>
      </div>
    )
  }

  // Filter presets by current method
  const filteredPresets = endpointPresets.presets.filter(
    (p) => p.method === currentMethod
  )

  const handleApplyPreset = (preset: ApiPreset) => {
    onApplyPreset(preset)
    setIsDetailOpen(false)
  }

  return (
    <div className="p-4 space-y-4" data-cy={sel('devtools.apiExplorer.presets.tab')}>
      {endpointPresets.summary && (
        <p className="text-sm text-muted-foreground">{endpointPresets.summary}</p>
      )}

      {filteredPresets.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">
          <p>No presets for <strong>{currentMethod}</strong> method.</p>
          <p className="mt-1 text-xs">
            Available methods:{' '}
            {[...new Set(endpointPresets.presets.map((p) => p.method))].join(', ')}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {filteredPresets.map((preset) => (
            <Card
              key={preset.id}
              className="hover:border-primary/50 transition-colors"
              data-cy={sel('devtools.apiExplorer.presets.card', { id: preset.id })}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-medium truncate">
                      {preset.title}
                    </CardTitle>
                    {preset.description && (
                      <CardDescription className="text-xs mt-1 line-clamp-2">
                        {preset.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Dialog open={isDetailOpen && selectedPreset?.id === preset.id} onOpenChange={(open) => {
                      setIsDetailOpen(open)
                      if (open) setSelectedPreset(preset)
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          data-cy={sel('devtools.apiExplorer.presets.viewBtn', { id: preset.id })}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>{preset.title}</DialogTitle>
                        </DialogHeader>
                        <PresetDetails preset={preset} />
                        <DialogFooter>
                          <Button onClick={() => handleApplyPreset(preset)}>
                            <Play className="h-4 w-4 mr-2" />
                            Apply Preset
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleApplyPreset(preset)}
                      data-cy={sel('devtools.apiExplorer.presets.applyBtn', { id: preset.id })}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {preset.tags && preset.tags.length > 0 && (
                <CardContent className="p-4 pt-0">
                  <div className="flex gap-1 flex-wrap">
                    {preset.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Show count of presets in other methods */}
      {filteredPresets.length < endpointPresets.presets.length && (
        <p className="text-xs text-muted-foreground mt-4">
          {endpointPresets.presets.length - filteredPresets.length} more preset(s) available for other methods
        </p>
      )}
    </div>
  )
}

interface PresetDetailsProps {
  preset: ApiPreset
}

function PresetDetails({ preset }: PresetDetailsProps) {
  return (
    <ScrollArea className="max-h-[60vh]">
      <div className="space-y-4 pr-4">
        {preset.description && (
          <div>
            <h4 className="text-sm font-medium mb-1">Description</h4>
            <p className="text-sm text-muted-foreground">{preset.description}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Method:</h4>
          <Badge variant="outline">{preset.method}</Badge>
        </div>

        {preset.pathParams && Object.keys(preset.pathParams).length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Path Parameters</h4>
            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
              {JSON.stringify(preset.pathParams, null, 2)}
            </pre>
          </div>
        )}

        {preset.params && Object.keys(preset.params).length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Query Parameters</h4>
            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
              {JSON.stringify(preset.params, null, 2)}
            </pre>
          </div>
        )}

        {preset.headers && Object.keys(preset.headers).length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Headers</h4>
            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
              {JSON.stringify(preset.headers, null, 2)}
            </pre>
          </div>
        )}

        {preset.payload && Object.keys(preset.payload).length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Request Body</h4>
            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
              {JSON.stringify(preset.payload, null, 2)}
            </pre>
          </div>
        )}

        {preset.sessionConfig && Object.keys(preset.sessionConfig).length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Session Config</h4>
            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
              {JSON.stringify(preset.sessionConfig, null, 2)}
            </pre>
          </div>
        )}

        {preset.tags && preset.tags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Tags</h4>
            <div className="flex gap-1 flex-wrap">
              {preset.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
