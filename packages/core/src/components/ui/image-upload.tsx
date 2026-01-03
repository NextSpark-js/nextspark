"use client"

import * as React from "react"
import NextImage from "next/image"
import { X, Eye, Download, Image } from "lucide-react"
import { Button } from './button'
import { Dialog, DialogContent, DialogTrigger } from './dialog'
import { cn } from '../../lib/utils'

export interface UploadedImage {
  id: string
  name: string
  size: number
  url: string
  alt?: string
  width?: number
  height?: number
}

interface ImageUploadProps {
  value: UploadedImage[]
  onChange: (images: UploadedImage[]) => void
  maxImages?: number
  maxSize?: number // in MB
  disabled?: boolean
  className?: string
  multiple?: boolean
  aspectRatio?: "square" | "landscape" | "portrait" | "free"
  showPreview?: boolean
}

export function ImageUpload({
  value = [],
  onChange,
  maxImages = 5,
  maxSize = 5, // 5MB default
  disabled = false,
  className,
  multiple = true,
  aspectRatio = "free",
  showPreview = true,
}: ImageUploadProps) {
  const [isDragOver, setIsDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const validateImage = (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      if (maxSize && file.size > maxSize * 1024 * 1024) {
        resolve(`La imagen es muy grande. Máximo ${maxSize}MB.`)
        return
      }

      if (!file.type.startsWith("image/")) {
        resolve("El archivo debe ser una imagen.")
        return
      }

      // Validate image dimensions if needed
      const img = document.createElement('img')
      img.onload = () => {
        // Add dimension validation if needed
        resolve(null)
      }
      img.onerror = () => {
        resolve("No se pudo cargar la imagen.")
      }
      img.src = URL.createObjectURL(file)
    })
  }

  const handleFiles = async (files: FileList) => {
    if (disabled) return

    const newImages: UploadedImage[] = []
    const errors: string[] = []

    for (const file of Array.from(files)) {
      if (value.length + newImages.length >= maxImages) {
        errors.push(`Máximo ${maxImages} imágenes permitidas`)
        break
      }

      const error = await validateImage(file)
      if (error) {
        errors.push(`${file.name}: ${error}`)
        continue
      }

      const uploadedImage: UploadedImage = {
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file),
        alt: file.name.split(".")[0],
      }

      newImages.push(uploadedImage)
    }

    if (errors.length > 0) {
      console.warn("Image upload errors:", errors)
    }

    if (newImages.length > 0) {
      onChange([...value, ...newImages])
    }
  }

  const removeImage = (imageId: string) => {
    if (disabled) return
    onChange(value.filter(img => img.id !== imageId))
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
    
    if (!disabled && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }

  const openFileDialog = () => {
    if (!disabled) {
      inputRef.current?.click()
    }
  }

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case "square": return "aspect-square"
      case "landscape": return "aspect-video"
      case "portrait": return "aspect-[3/4]"
      default: return ""
    }
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Upload Area */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isDragOver && "border-primary bg-primary/5",
          !isDragOver && "border-muted-foreground/25",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "cursor-pointer hover:border-primary/50",
          getAspectRatioClass()
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <div className="flex flex-col items-center justify-center h-full">
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image className="h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Arrastra imágenes aquí o{" "}
            <span className="font-medium text-primary">haz clic para seleccionar</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {maxImages > 1 ? `Hasta ${maxImages} imágenes` : "Una imagen"} 
            {maxSize && `, máximo ${maxSize}MB cada una`}
          </p>
        </div>
        
        <input
          ref={inputRef}
          type="file"
          multiple={multiple && maxImages > 1}
          accept="image/*"
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={disabled}
        />
      </div>

      {/* Images Grid */}
      {value.length > 0 && showPreview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {value.map((image) => (
            <div
              key={image.id}
              className="relative group border rounded-lg overflow-hidden bg-background"
            >
              <div className={cn("relative", getAspectRatioClass() || "aspect-square")}>
                <NextImage
                  src={image.url}
                  alt={image.alt || image.name}
                  fill
                  className="object-cover"
                />
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="secondary" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <NextImage
                        src={image.url}
                        alt={image.alt || image.name}
                        width={800}
                        height={600}
                        className="w-full h-auto max-h-[70vh] object-contain"
                      />
                    </DialogContent>
                  </Dialog>
                  
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.open(image.url, "_blank")}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeImage(image.id)}
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Image info */}
              <div className="p-2">
                <p className="text-xs font-medium truncate">{image.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(image.size)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
