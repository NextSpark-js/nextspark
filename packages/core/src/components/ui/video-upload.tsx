"use client"

import * as React from "react"
import NextImage from "next/image"
import { X, Play, Download, Video } from "lucide-react"
import { Button } from './button'
import { cn } from '../../lib/utils'

export interface UploadedVideo {
  id: string
  name: string
  size: number
  url: string
  duration?: number
  thumbnail?: string
}

interface VideoUploadProps {
  value: UploadedVideo[]
  onChange: (videos: UploadedVideo[]) => void
  maxVideos?: number
  maxSize?: number // in MB
  disabled?: boolean
  className?: string
  multiple?: boolean
  acceptedFormats?: string[]
}

export function VideoUpload({
  value = [],
  onChange,
  maxVideos = 3,
  maxSize = 100, // 100MB default
  disabled = false,
  className,
  multiple = true,
  acceptedFormats = ["mp4", "mov", "avi", "mkv", "webm"],
}: VideoUploadProps) {
  const [isDragOver, setIsDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const validateVideo = (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      if (maxSize && file.size > maxSize * 1024 * 1024) {
        resolve(`El video es muy grande. Máximo ${maxSize}MB.`)
        return
      }

      if (!file.type.startsWith("video/")) {
        resolve("El archivo debe ser un video.")
        return
      }

      const fileExtension = file.name.split(".").pop()?.toLowerCase()
      if (fileExtension && !acceptedFormats.includes(fileExtension)) {
        resolve(`Formato no soportado. Formatos aceptados: ${acceptedFormats.join(", ")}`)
        return
      }

      resolve(null)
    })
  }

  const generateThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      
      video.onloadedmetadata = () => {
        video.currentTime = video.duration / 2 // Middle of video
      }
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        resolve(canvas.toDataURL())
      }
      
      video.onerror = () => {
        resolve('') // Return empty string if thumbnail generation fails
      }
      
      video.src = URL.createObjectURL(file)
    })
  }

  const handleFiles = async (files: FileList) => {
    if (disabled) return

    const newVideos: UploadedVideo[] = []
    const errors: string[] = []

    for (const file of Array.from(files)) {
      if (value.length + newVideos.length >= maxVideos) {
        errors.push(`Máximo ${maxVideos} videos permitidos`)
        break
      }

      const error = await validateVideo(file)
      if (error) {
        errors.push(`${file.name}: ${error}`)
        continue
      }

      const thumbnail = await generateThumbnail(file)
      
      const uploadedVideo: UploadedVideo = {
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file),
        thumbnail,
      }

      newVideos.push(uploadedVideo)
    }

    if (errors.length > 0) {
      console.warn("Video upload errors:", errors)
    }

    if (newVideos.length > 0) {
      onChange([...value, ...newVideos])
    }
  }

  const removeVideo = (videoId: string) => {
    if (disabled) return
    onChange(value.filter(video => video.id !== videoId))
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

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Upload Area */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isDragOver && "border-primary bg-primary/5",
          !isDragOver && "border-muted-foreground/25",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "cursor-pointer hover:border-primary/50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <Video className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Arrastra videos aquí o{" "}
          <span className="font-medium text-primary">haz clic para seleccionar</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {maxVideos > 1 ? `Hasta ${maxVideos} videos` : "Un video"} 
          {maxSize && `, máximo ${maxSize}MB cada uno`}
        </p>
        <p className="text-xs text-muted-foreground">
          Formatos: {acceptedFormats.join(", ")}
        </p>
        
        <input
          ref={inputRef}
          type="file"
          multiple={multiple && maxVideos > 1}
          accept="video/*"
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={disabled}
        />
      </div>

      {/* Videos List */}
      {value.length > 0 && (
        <div className="space-y-4">
          {value.map((video) => (
            <div
              key={video.id}
              className="flex items-center gap-4 p-4 border rounded-lg bg-background"
            >
              {/* Thumbnail */}
              <div className="relative w-24 h-16 bg-muted rounded overflow-hidden">
                {video.thumbnail ? (
                  <NextImage
                    src={video.thumbnail}
                    alt={video.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="h-4 w-4 text-white" />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{video.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(video.size)}
                  {video.duration && ` • ${formatDuration(video.duration)}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(video.url, "_blank")}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeVideo(video.id)}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
