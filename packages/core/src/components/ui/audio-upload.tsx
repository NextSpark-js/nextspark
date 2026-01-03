"use client"

import * as React from "react"
import { X, Play, Pause, Download, Music } from "lucide-react"
import { Button } from './button'
import { Progress } from './progress'
import { cn } from '../../lib/utils'

export interface UploadedAudio {
  id: string
  name: string
  size: number
  url: string
  duration?: number
}

interface AudioUploadProps {
  value: UploadedAudio[]
  onChange: (audios: UploadedAudio[]) => void
  maxAudios?: number
  maxSize?: number // in MB
  disabled?: boolean
  className?: string
  multiple?: boolean
  acceptedFormats?: string[]
  showPlayer?: boolean
}

export function AudioUpload({
  value = [],
  onChange,
  maxAudios = 5,
  maxSize = 50, // 50MB default
  disabled = false,
  className,
  multiple = true,
  acceptedFormats = ["mp3", "wav", "ogg", "m4a", "aac"],
  showPlayer = true,
}: AudioUploadProps) {
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [playingId, setPlayingId] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState<Record<string, number>>({})
  const inputRef = React.useRef<HTMLInputElement>(null)
  const audioRefs = React.useRef<Record<string, HTMLAudioElement>>({})

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

  const validateAudio = (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      if (maxSize && file.size > maxSize * 1024 * 1024) {
        resolve(`El audio es muy grande. Máximo ${maxSize}MB.`)
        return
      }

      if (!file.type.startsWith("audio/")) {
        resolve("El archivo debe ser un audio.")
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

  const getAudioDuration = (file: File): Promise<number | undefined> => {
    return new Promise((resolve) => {
      const audio = document.createElement('audio')
      audio.preload = 'metadata'
      
      audio.onloadedmetadata = () => {
        resolve(audio.duration)
      }
      
      audio.onerror = () => {
        resolve(undefined)
      }
      
      audio.src = URL.createObjectURL(file)
    })
  }

  const handleFiles = async (files: FileList) => {
    if (disabled) return

    const newAudios: UploadedAudio[] = []
    const errors: string[] = []

    for (const file of Array.from(files)) {
      if (value.length + newAudios.length >= maxAudios) {
        errors.push(`Máximo ${maxAudios} audios permitidos`)
        break
      }

      const error = await validateAudio(file)
      if (error) {
        errors.push(`${file.name}: ${error}`)
        continue
      }

      const duration = await getAudioDuration(file)
      
      const uploadedAudio: UploadedAudio = {
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file),
        duration,
      }

      newAudios.push(uploadedAudio)
    }

    if (errors.length > 0) {
      console.warn("Audio upload errors:", errors)
    }

    if (newAudios.length > 0) {
      onChange([...value, ...newAudios])
    }
  }

  const removeAudio = (audioId: string) => {
    if (disabled) return
    if (playingId === audioId) {
      setPlayingId(null)
    }
    if (audioRefs.current[audioId]) {
      delete audioRefs.current[audioId]
    }
    onChange(value.filter(audio => audio.id !== audioId))
  }

  const togglePlay = (audio: UploadedAudio) => {
    if (!showPlayer) return

    if (playingId === audio.id) {
      // Pause current audio
      audioRefs.current[audio.id]?.pause()
      setPlayingId(null)
    } else {
      // Stop any currently playing audio
      if (playingId && audioRefs.current[playingId]) {
        audioRefs.current[playingId].pause()
      }

      // Create or get audio element
      if (!audioRefs.current[audio.id]) {
        const audioElement = new Audio(audio.url)
        audioRefs.current[audio.id] = audioElement

        audioElement.addEventListener('timeupdate', () => {
          if (audioElement.duration) {
            const progressPercent = (audioElement.currentTime / audioElement.duration) * 100
            setProgress(prev => ({ ...prev, [audio.id]: progressPercent }))
          }
        })

        audioElement.addEventListener('ended', () => {
          setPlayingId(null)
          setProgress(prev => ({ ...prev, [audio.id]: 0 }))
        })
      }

      // Play audio
      audioRefs.current[audio.id].play()
      setPlayingId(audio.id)
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
        <Music className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Arrastra audios aquí o{" "}
          <span className="font-medium text-primary">haz clic para seleccionar</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {maxAudios > 1 ? `Hasta ${maxAudios} audios` : "Un audio"} 
          {maxSize && `, máximo ${maxSize}MB cada uno`}
        </p>
        <p className="text-xs text-muted-foreground">
          Formatos: {acceptedFormats.join(", ")}
        </p>
        
        <input
          ref={inputRef}
          type="file"
          multiple={multiple && maxAudios > 1}
          accept="audio/*"
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={disabled}
        />
      </div>

      {/* Audios List */}
      {value.length > 0 && (
        <div className="space-y-4">
          {value.map((audio) => (
            <div
              key={audio.id}
              className="flex items-center gap-4 p-4 border rounded-lg bg-background"
            >
              {/* Play/Pause Button */}
              {showPlayer && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => togglePlay(audio)}
                  className="flex-shrink-0"
                >
                  {playingId === audio.id ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              )}

              {/* Audio Icon (if no player) */}
              {!showPlayer && (
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  <Music className="h-5 w-5 text-muted-foreground" />
                </div>
              )}

              {/* Info and Progress */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{audio.name}</p>
                <p className="text-xs text-muted-foreground mb-2">
                  {formatFileSize(audio.size)}
                  {audio.duration && ` • ${formatDuration(audio.duration)}`}
                </p>
                
                {showPlayer && playingId === audio.id && (
                  <Progress 
                    value={progress[audio.id] || 0} 
                    className="h-1" 
                  />
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(audio.url, "_blank")}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAudio(audio.id)}
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
