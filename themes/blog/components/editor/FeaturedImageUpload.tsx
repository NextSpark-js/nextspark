'use client'

/**
 * Featured Image Upload Component
 *
 * A simple single-image upload component for blog post featured images.
 * Supports drag & drop, click to upload, and preview.
 */

import * as React from 'react'
import NextImage from 'next/image'
import { X, Upload, Image as ImageIcon } from 'lucide-react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { cn } from '@nextsparkjs/core/lib/utils'

interface FeaturedImageUploadProps {
  value: string // URL string
  onChange: (url: string) => void
  disabled?: boolean
  className?: string
}

export function FeaturedImageUpload({
  value,
  onChange,
  disabled = false,
  className,
}: FeaturedImageUploadProps) {
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (disabled) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // For now, create a local object URL
      // In production, you would upload to a storage service
      const objectUrl = URL.createObjectURL(file)
      onChange(objectUrl)
    } catch (err) {
      setError('Failed to process image')
      console.error('Image upload error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    if (!disabled && e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0])
    }
  }

  const openFileDialog = () => {
    if (!disabled) {
      inputRef.current?.click()
    }
  }

  const removeImage = () => {
    if (!disabled) {
      onChange('')
      setError(null)
    }
  }

  // Check if value is a valid URL or blob URL
  const hasImage = value && (value.startsWith('http') || value.startsWith('blob:'))

  return (
    <div className={cn('w-full space-y-2', className)} data-cy="featured-image-container">
      {hasImage ? (
        // Image Preview
        <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-muted" data-cy="featured-image-preview">
          <NextImage
            src={value}
            alt="Featured image preview"
            fill
            className="object-cover"
            unoptimized={value.startsWith('blob:')}
          />
          {/* Remove button */}
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={removeImage}
            disabled={disabled}
            data-cy="featured-image-remove"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        // Upload Area
        <div
          className={cn(
            'relative aspect-video border-2 border-dashed rounded-lg transition-colors cursor-pointer',
            isDragOver && 'border-primary bg-primary/5',
            !isDragOver && 'border-muted-foreground/25 hover:border-primary/50',
            disabled && 'opacity-50 cursor-not-allowed',
            isLoading && 'animate-pulse'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openFileDialog}
          data-cy="featured-image-dropzone"
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isLoading ? (
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" data-cy="featured-image-loading" />
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground text-center px-4">
                  <span className="font-medium text-primary">Click to upload</span>
                  {' '}or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, GIF up to 5MB
                </p>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="sr-only"
            disabled={disabled || isLoading}
            data-cy="featured-image-input"
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-destructive" data-cy="featured-image-error">{error}</p>
      )}
    </div>
  )
}

export default FeaturedImageUpload
