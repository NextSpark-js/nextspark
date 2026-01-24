import React from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { cn } from '@nextsparkjs/core/lib/utils'
import { buildSectionClasses } from '@nextsparkjs/core/types/blocks'
import { sel } from '../../lib/selectors'
import type { VideoHeroBlockProps } from './schema'

/**
 * Video Hero Block Component
 *
 * Props from 3-tab structure:
 * - Content: title, content (subtitle), cta, videoUrl, videoThumbnail
 * - Design: backgroundColor, layout, autoplay, overlayOpacity
 * - Advanced: className, id
 */

/**
 * Extract video ID from YouTube or Vimeo URL
 */
function parseVideoUrl(url: string): { platform: 'youtube' | 'vimeo' | null; videoId: string | null } {
  // YouTube patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]+)/,
  ]

  for (const pattern of youtubePatterns) {
    const match = url.match(pattern)
    if (match) {
      return { platform: 'youtube', videoId: match[1] }
    }
  }

  // Vimeo pattern
  const vimeoPattern = /vimeo\.com\/(\d+)/
  const vimeoMatch = url.match(vimeoPattern)
  if (vimeoMatch) {
    return { platform: 'vimeo', videoId: vimeoMatch[1] }
  }

  return { platform: null, videoId: null }
}

/**
 * Get embed URL for video
 */
function getEmbedUrl(videoUrl: string, autoplay: boolean): string | null {
  const { platform, videoId } = parseVideoUrl(videoUrl)

  if (!platform || !videoId) return null

  if (platform === 'youtube') {
    const params = new URLSearchParams({
      autoplay: autoplay ? '1' : '0',
      mute: autoplay ? '1' : '0', // Mute if autoplay (browser requirement)
      rel: '0', // Don't show related videos
      modestbranding: '1', // Minimal YouTube branding
    })
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
  }

  if (platform === 'vimeo') {
    const params = new URLSearchParams({
      autoplay: autoplay ? '1' : '0',
      muted: autoplay ? '1' : '0',
      title: '0',
      byline: '0',
      portrait: '0',
    })
    return `https://player.vimeo.com/video/${videoId}?${params.toString()}`
  }

  return null
}

export function VideoHeroBlock({
  // Base content props
  title,
  content,
  cta,
  // Video-specific content
  videoUrl,
  videoThumbnail,
  // Base design props
  backgroundColor,
  // Video-specific design
  layout = 'inline',
  autoplay = false,
  overlayOpacity = '40',
  // Base advanced props
  className,
  id,
}: VideoHeroBlockProps) {
  const embedUrl = getEmbedUrl(videoUrl, autoplay)

  // Build base section classes
  const baseSectionClasses = buildSectionClasses(
    cn('relative overflow-hidden'),
    { backgroundColor, className }
  )

  // Overlay opacity class for background layout
  const overlayClass = overlayOpacity === '0'
    ? 'bg-transparent'
    : `bg-black/${overlayOpacity}`

  // Video container with 16:9 aspect ratio
  const VideoEmbed = () => {
    if (!embedUrl) {
      return (
        <div className="flex items-center justify-center bg-gray-200 text-gray-600 p-8 rounded-lg">
          <p>Invalid video URL. Please provide a valid YouTube or Vimeo link.</p>
        </div>
      )
    }

    return (
      <div className="relative w-full pb-[56.25%]">
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title || 'Video'}
        />
      </div>
    )
  }

  // LAYOUT: Background (fullscreen video with overlay)
  if (layout === 'background') {
    return (
      <section
        id={id}
        className={cn(baseSectionClasses, 'min-h-[600px] flex items-center justify-center')}
        data-cy={sel('blocks.videoHero.container')}
      >
        {/* Background Video */}
        <div className="absolute inset-0 z-0">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full object-cover"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              title={title || 'Background Video'}
            />
          ) : null}
          <div className={cn('absolute inset-0', overlayClass)} />
        </div>

        {/* Content Overlay */}
        <div className="container relative z-10 mx-auto max-w-4xl text-center px-4 py-20 text-white">
          {title && (
            <h1 className="mb-6 text-5xl font-bold leading-tight @md:text-6xl @lg:text-7xl">
              {title}
            </h1>
          )}

          {content && (
            <p className="mb-8 text-xl @md:text-2xl opacity-90">
              {content}
            </p>
          )}

          {cta && (
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <a
                href={cta.link}
                target={cta.target}
                rel={cta.target === '_blank' ? 'noopener noreferrer' : undefined}
              >
                {cta.text}
              </a>
            </Button>
          )}
        </div>
      </section>
    )
  }

  // LAYOUT: Side-by-side (text left, video right)
  if (layout === 'side-by-side') {
    return (
      <section
        id={id}
        className={cn(baseSectionClasses, 'py-16 px-4')}
        data-cy={sel('blocks.videoHero.container')}
      >
        <div className="container mx-auto">
          <div className="grid grid-cols-1 @lg:grid-cols-2 gap-8 items-center">
            {/* Text Content */}
            <div className="space-y-6">
              {title && (
                <h1 className="text-4xl font-bold leading-tight @md:text-5xl @lg:text-6xl">
                  {title}
                </h1>
              )}

              {content && (
                <p className="text-lg @md:text-xl text-gray-600">
                  {content}
                </p>
              )}

              {cta && (
                <Button asChild size="lg" className="text-lg px-8 py-6">
                  <a
                    href={cta.link}
                    target={cta.target}
                    rel={cta.target === '_blank' ? 'noopener noreferrer' : undefined}
                  >
                    {cta.text}
                  </a>
                </Button>
              )}
            </div>

            {/* Video */}
            <div>
              <VideoEmbed />
            </div>
          </div>
        </div>
      </section>
    )
  }

  // LAYOUT: Inline (default - text above, video below)
  return (
    <section
      id={id}
      className={cn(baseSectionClasses, 'py-16 px-4')}
      data-cy="block-video-hero"
    >
      <div className="container mx-auto max-w-5xl">
        {/* Text Content */}
        <div className="text-center mb-10 space-y-6">
          {title && (
            <h1 className="text-4xl font-bold leading-tight @md:text-5xl @lg:text-6xl">
              {title}
            </h1>
          )}

          {content && (
            <p className="text-lg @md:text-xl text-gray-600 max-w-3xl mx-auto">
              {content}
            </p>
          )}

          {cta && (
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <a
                href={cta.link}
                target={cta.target}
                rel={cta.target === '_blank' ? 'noopener noreferrer' : undefined}
              >
                {cta.text}
              </a>
            </Button>
          )}
        </div>

        {/* Video */}
        <div className="max-w-4xl mx-auto">
          <VideoEmbed />
        </div>
      </div>
    </section>
  )
}
