"use client"

import * as React from "react"
import { Upload, File, X, FileText, Download } from "lucide-react"
import { Button } from './button'
import { Progress } from './progress'
import { cn } from '../../lib/utils'

export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  url?: string
  uploadProgress?: number
}

interface FileUploadProps {
  value: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
  maxFiles?: number
  maxSize?: number // in MB
  acceptedTypes?: string[]
  disabled?: boolean
  className?: string
  multiple?: boolean
  dragDrop?: boolean
}

export function FileUpload({
  value = [],
  onChange,
  maxFiles = 5,
  maxSize = 10, // 10MB default
  acceptedTypes = ["*"],
  disabled = false,
  className,
  multiple = true,
  dragDrop = true,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize * 1024 * 1024) {
      return `El archivo es muy grande. Máximo ${maxSize}MB.`
    }

    if (acceptedTypes.length > 0 && !acceptedTypes.includes("*")) {
      const fileExtension = "." + file.name.split(".").pop()?.toLowerCase()
      const mimeType = file.type
      
      const isValid = acceptedTypes.some(type => 
        type === mimeType || 
        type === fileExtension ||
        (type.endsWith("/*") && mimeType.startsWith(type.replace("/*", "")))
      )

      if (!isValid) {
        return `Tipo de archivo no permitido. Tipos aceptados: ${acceptedTypes.join(", ")}`
      }
    }

    return null
  }

  const handleFiles = (files: FileList) => {
    if (disabled) return

    const newFiles: UploadedFile[] = []
    const errors: string[] = []

    Array.from(files).forEach((file) => {
      if (value.length + newFiles.length >= maxFiles) {
        errors.push(`Máximo ${maxFiles} archivos permitidos`)
        return
      }

      const error = validateFile(file)
      if (error) {
        errors.push(`${file.name}: ${error}`)
        return
      }

      const uploadedFile: UploadedFile = {
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
        uploadProgress: 100, // Simulate immediate upload for demo
      }

      newFiles.push(uploadedFile)
    })

    if (errors.length > 0) {
      console.warn("File upload errors:", errors)
      // You could show these errors in a toast or alert
    }

    if (newFiles.length > 0) {
      onChange([...value, ...newFiles])
    }
  }

  const removeFile = (fileId: string) => {
    if (disabled) return
    onChange(value.filter(file => file.id !== fileId))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled && dragDrop) {
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
    
    if (!disabled && dragDrop && e.dataTransfer.files) {
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
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          {dragDrop ? "Arrastra archivos aquí o " : ""}
          <span className="font-medium text-primary">haz clic para seleccionar</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {maxFiles > 1 ? `Hasta ${maxFiles} archivos` : "Un archivo"} 
          {maxSize && `, máximo ${maxSize}MB cada uno`}
        </p>
        
        <input
          ref={inputRef}
          type="file"
          multiple={multiple && maxFiles > 1}
          accept={acceptedTypes.join(",")}
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={disabled}
        />
      </div>

      {/* Files List */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 border rounded-lg bg-background"
            >
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
                {file.uploadProgress !== undefined && file.uploadProgress < 100 && (
                  <Progress value={file.uploadProgress} className="mt-2" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {file.url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(file.url, "_blank")
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFile(file.id)
                  }}
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

