/**
 * MediaSelector Component
 *
 * Form field component for selecting media.
 * Opens MediaLibrary modal and displays selected media preview.
 * Integrates with React Hook Form if used in a form context.
 */

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ImageIcon, XIcon } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { MediaLibrary } from './MediaLibrary'
import { useMediaItem } from '../../hooks/useMedia'
import { cn } from '../../lib/utils'
import { sel } from '../../lib/selectors'
import type { Media } from '../../lib/media/types'

interface MediaSelectorProps {
  value?: string | null
  onChange?: (mediaId: string | null, media: Media | null) => void
  mode?: 'single'
  allowedTypes?: ('image' | 'video')[]
  className?: string
  disabled?: boolean
}

export function MediaSelector({
  value,
  onChange,
  mode = 'single',
  allowedTypes,
  className,
  disabled = false,
}: MediaSelectorProps) {
  const t = useTranslations('media')
  const [isLibraryOpen, setIsLibraryOpen] = React.useState(false)

  // Fetch media details if value is set
  const { data: selectedMedia, isLoading } = useMediaItem(value || null)

  const handleSelect = (media: Media | Media[]) => {
    if (Array.isArray(media)) {
      // Multiple mode not supported for now
      return
    }

    onChange?.(media.id, media)
    setIsLibraryOpen(false)
  }

  const handleRemove = () => {
    onChange?.(null, null)
  }

  const handleOpenLibrary = () => {
    if (!disabled) {
      setIsLibraryOpen(true)
    }
  }

  const isImage = selectedMedia?.mimeType.startsWith('image/')

  return (
    <>
      <div
        data-cy={sel('media.selector.container')}
        className={cn('space-y-2', className)}
      >
        {!value || !selectedMedia ? (
          // Empty state
          <Card
            className={cn(
              'border-2 border-dashed cursor-pointer hover:border-primary/50 transition-colors',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onClick={handleOpenLibrary}
          >
            <CardContent className="flex flex-col items-center justify-center py-8">
              <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-4">
                {t('selector.noSelection')}
              </p>
              <Button
                data-cy={sel('media.selector.selectBtn')}
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenLibrary()
                }}
              >
                {t('selector.selectMedia')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          // Selected state
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Preview */}
                <div
                  data-cy={sel('media.selector.preview')}
                  className="shrink-0 w-20 h-20 rounded bg-muted overflow-hidden flex items-center justify-center"
                >
                  {isImage ? (
                    <img
                      src={selectedMedia.url}
                      alt={selectedMedia.alt || selectedMedia.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>

                {/* Info and actions */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" title={selectedMedia.filename}>
                    {selectedMedia.filename}
                  </p>
                  {selectedMedia.width && selectedMedia.height && (
                    <p className="text-sm text-muted-foreground">
                      {t('grid.dimensions', {
                        width: selectedMedia.width,
                        height: selectedMedia.height,
                      })}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 shrink-0">
                  <Button
                    data-cy={sel('media.selector.changeBtn')}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={handleOpenLibrary}
                  >
                    {t('selector.change')}
                  </Button>
                  <Button
                    data-cy={sel('media.selector.removeBtn')}
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={disabled}
                    onClick={handleRemove}
                    aria-label={t('selector.remove')}
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Media Library Modal */}
      <MediaLibrary
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelect={handleSelect}
        mode={mode}
        allowedTypes={allowedTypes}
      />
    </>
  )
}
