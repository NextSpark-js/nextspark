/**
 * MediaTagFilter Component
 *
 * Tag-based filter chips for the media toolbar.
 * Shows available media_tag taxonomies and allows selecting one or more.
 *
 * Performance: Wrapped with memo. Uses Set for O(1) tag lookups.
 */

'use client'

import { memo, useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { TagIcon, XIcon } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover'
import { cn } from '../../lib/utils'
import { sel } from '../../lib/selectors'
import { useMediaTags } from '../../hooks/useMedia'
import type { MediaTag } from '../../lib/media/types'

interface MediaTagFilterProps {
  selectedTagIds: string[]
  onTagsChange: (tagIds: string[]) => void
  className?: string
}

export const MediaTagFilter = memo(function MediaTagFilter({
  selectedTagIds,
  onTagsChange,
  className,
}: MediaTagFilterProps) {
  const t = useTranslations('media')
  const { data: tags = [], isLoading } = useMediaTags()
  const [isOpen, setIsOpen] = useState(false)

  const selectedIdSet = useMemo(() => new Set(selectedTagIds), [selectedTagIds])
  const selectedTags = useMemo(
    () => tags.filter((tag: MediaTag) => selectedIdSet.has(tag.id)),
    [tags, selectedIdSet]
  )

  const toggleTag = useCallback((tagId: string) => {
    if (selectedIdSet.has(tagId)) {
      onTagsChange(selectedTagIds.filter(id => id !== tagId))
    } else {
      onTagsChange([...selectedTagIds, tagId])
    }
  }, [selectedIdSet, selectedTagIds, onTagsChange])

  const clearTags = useCallback(() => {
    onTagsChange([])
  }, [onTagsChange])

  if (isLoading) return null

  return (
    <div
      data-cy={sel('media.tagFilter.container')}
      className={cn('flex items-center gap-2 flex-wrap', className)}
    >
      {/* Tag selector popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            data-cy={sel('media.tagFilter.trigger')}
            variant="outline"
            size="sm"
            className="h-8 gap-1"
          >
            <TagIcon className="h-3.5 w-3.5" />
            {t('dashboard.tags')}
            {selectedTagIds.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                {selectedTagIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          data-cy={sel('media.tagFilter.popover')}
          className="w-64 p-3"
          align="start"
        >
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('dashboard.filterByTag')}</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('dashboard.noTags')}</p>
              ) : (
                tags.map((tag: MediaTag) => {
                  const isSelected = selectedIdSet.has(tag.id)
                  return (
                    <Badge
                      key={tag.id}
                      data-cy={sel('media.tagFilter.tag', { id: tag.id })}
                      variant={isSelected ? 'default' : 'outline'}
                      className={cn(
                        'cursor-pointer transition-colors',
                        isSelected && tag.color && 'border-transparent'
                      )}
                      style={isSelected && tag.color ? { backgroundColor: tag.color, color: '#fff' } : undefined}
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.name}
                    </Badge>
                  )
                })
              )}
            </div>
            {selectedTagIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={clearTags}
              >
                {t('dashboard.clearSelection')}
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Active tag chips */}
      {selectedTags.map((tag: MediaTag) => (
        <Badge
          key={tag.id}
          data-cy={sel('media.tagFilter.activeTag', { id: tag.id })}
          variant="secondary"
          className="gap-1 cursor-pointer hover:bg-destructive/20"
          style={tag.color ? { borderColor: tag.color } : undefined}
          onClick={() => toggleTag(tag.id)}
        >
          {tag.name}
          <XIcon className="h-3 w-3" />
        </Badge>
      ))}
    </div>
  )
})
