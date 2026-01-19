"use client"

import * as React from "react"
import Image, { type ImageProps } from "next/image"
import { cn } from "../../lib/utils"

export interface OptimizedImageProps extends Omit<ImageProps, 'placeholder'> {
  /** Fallback component to render when image fails to load */
  fallback?: React.ReactNode
  /** Aspect ratio preset for the container */
  aspectRatio?: "square" | "video" | "portrait" | "auto"
  /** Additional classes for the container div (only used with fill or aspectRatio) */
  containerClassName?: string
  /** Enable blur placeholder (requires blurDataURL) */
  enableBlur?: boolean
  /** Base64 data URL for blur placeholder */
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
 * // With responsive sizes (CRITICAL for performance)
 * // The sizes prop tells the browser which image size to download
 * // Without it, Next.js generates all sizes, impacting performance
 * <OptimizedImage
 *   src="/hero.jpg"
 *   alt="Hero"
 *   fill
 *   sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
 * />
 *
 * @example
 * // Hero image (above the fold) - use priority to preload
 * // This avoids LCP issues for important visible images
 * <OptimizedImage
 *   src="/hero.jpg"
 *   alt="Hero"
 *   fill
 *   priority
 *   sizes="100vw"
 * />
 *
 * @example
 * // With blur placeholder for smooth loading transition
 * <OptimizedImage
 *   src="/photo.jpg"
 *   alt="Photo"
 *   width={400}
 *   height={300}
 *   enableBlur
 *   blurDataURL="data:image/jpeg;base64,..."
 * />
 *
 * @example
 * // High quality for marketing/hero images (default is 75)
 * <OptimizedImage
 *   src="/hero.jpg"
 *   alt="Hero"
 *   fill
 *   quality={90}
 *   priority
 *   sizes="100vw"
 * />
 *
 * @see https://nextjs.org/docs/app/api-reference/components/image#sizes
 * @see https://nextjs.org/docs/app/api-reference/components/image#priority
 * @see https://nextjs.org/docs/app/api-reference/components/image#quality
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
          {isLoading && !enableBlur && (
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
