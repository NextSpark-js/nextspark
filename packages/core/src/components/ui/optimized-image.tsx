"use client"

import * as React from "react"
import Image, { type ImageProps } from "next/image"
import { cn } from "../../lib/utils"

export interface OptimizedImageProps extends Omit<ImageProps, 'placeholder'> {
  fallback?: React.ReactNode
  aspectRatio?: "square" | "video" | "portrait" | "auto"
  containerClassName?: string
  enableBlur?: boolean
  blurDataURL?: string
}

/**
 * OptimizedImage - A wrapper around next/image with automatic optimization
 *
 * Features:
 * - Automatic WebP/AVIF format conversion (configured in next.config)
 * - Lazy loading by default
 * - Blur placeholder support
 * - Aspect ratio presets
 * - Fallback component for loading/error states
 *
 * @example
 * // Basic usage
 * <OptimizedImage src="/hero.jpg" alt="Hero" width={800} height={600} />
 *
 * @example
 * // With aspect ratio container (fill mode)
 * <OptimizedImage
 *   src="/product.jpg"
 *   alt="Product"
 *   fill
 *   aspectRatio="square"
 * />
 *
 * @example
 * // With blur placeholder
 * <OptimizedImage
 *   src="/photo.jpg"
 *   alt="Photo"
 *   width={400}
 *   height={300}
 *   enableBlur
 *   blurDataURL="data:image/jpeg;base64,..."
 * />
 */
const OptimizedImage = React.forwardRef<HTMLImageElement, OptimizedImageProps>(
  (
    {
      className,
      containerClassName,
      fallback,
      aspectRatio,
      enableBlur = false,
      blurDataURL,
      fill,
      alt,
      onError,
      ...props
    },
    ref
  ) => {
    const [hasError, setHasError] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(true)

    const handleError = React.useCallback(
      (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        setHasError(true)
        setIsLoading(false)
        onError?.(e)
      },
      [onError]
    )

    const handleLoad = React.useCallback(() => {
      setIsLoading(false)
    }, [])

    const getAspectRatioClass = () => {
      switch (aspectRatio) {
        case "square":
          return "aspect-square"
        case "video":
          return "aspect-video"
        case "portrait":
          return "aspect-[3/4]"
        default:
          return ""
      }
    }

    // Show fallback if there's an error
    if (hasError && fallback) {
      if (fill || aspectRatio) {
        return (
          <div
            className={cn(
              "relative overflow-hidden",
              getAspectRatioClass(),
              containerClassName
            )}
          >
            {fallback}
          </div>
        )
      }
      return <>{fallback}</>
    }

    // Build placeholder props
    const placeholderProps: Partial<ImageProps> = {}
    if (enableBlur && blurDataURL) {
      placeholderProps.placeholder = "blur"
      placeholderProps.blurDataURL = blurDataURL
    }

    // Render with container for fill mode or aspect ratio
    if (fill || aspectRatio) {
      return (
        <div
          className={cn(
            "relative overflow-hidden",
            getAspectRatioClass(),
            containerClassName
          )}
        >
          {isLoading && (
            <div className="absolute inset-0 bg-muted animate-pulse" />
          )}
          <Image
            ref={ref}
            className={cn(
              "object-cover transition-opacity duration-300",
              isLoading ? "opacity-0" : "opacity-100",
              className
            )}
            fill={fill ?? !!aspectRatio}
            alt={alt}
            onError={handleError}
            onLoad={handleLoad}
            {...placeholderProps}
            {...props}
          />
        </div>
      )
    }

    // Standard render without container
    return (
      <Image
        ref={ref}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        alt={alt}
        onError={handleError}
        onLoad={handleLoad}
        {...placeholderProps}
        {...props}
      />
    )
  }
)

OptimizedImage.displayName = "OptimizedImage"

export { OptimizedImage }
