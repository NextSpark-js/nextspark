import React from 'react'
import { cn } from '@nextsparkjs/core/lib/utils'
import { buildSectionClasses } from '@nextsparkjs/core/types/blocks'
import { sel } from '../../lib/selectors'
import type { PostContentBlockProps } from './schema'

/**
 * Post Content Block Component
 *
 * Beautiful editorial typography optimized for long-form reading.
 * Inspired by Medium, The New York Times, and other premium publishers.
 *
 * Props from 3-tab structure:
 * - Content: title, content (rich-text article body), cta
 * - Design: backgroundColor, drop cap, typography, dividers
 * - Advanced: className, id
 *
 * Features:
 * - Optimal reading width (680-900px)
 * - Beautiful line height (1.7-1.8) for readability
 * - Optional decorative drop cap
 * - Configurable typography scale
 * - Section dividers for visual breaks
 */
export function PostContentBlock({
  // Base content props
  title,
  content,
  cta,
  // Base design props
  backgroundColor,
  // Post-content-specific design
  showDropCap = false,
  dropCapStyle = 'serif',
  maxWidth = 'narrow',
  fontSize = 'medium',
  lineHeight = 'relaxed',
  paragraphSpacing = 'normal',
  showDividers = false,
  dividerStyle = 'line',
  // Base advanced props
  className,
  id,
}: PostContentBlockProps) {
  // Max width classes for optimal reading
  const maxWidthClasses: Record<string, string> = {
    narrow: 'max-w-[680px]', // Optimal for reading
    medium: 'max-w-[768px]',
    wide: 'max-w-[900px]',
  }

  // Font size classes
  const fontSizeClasses: Record<string, string> = {
    small: 'text-base', // 16px
    medium: 'text-lg', // 18px
    large: 'text-xl', // 20px
  }

  // Line height classes
  const lineHeightClasses: Record<string, string> = {
    compact: 'leading-relaxed', // 1.6
    normal: 'leading-loose', // 1.7
    relaxed: 'leading-[1.8]', // 1.8
  }

  // Paragraph spacing classes
  const paragraphSpacingClasses: Record<string, string> = {
    tight: '[&_p]:mb-4',
    normal: '[&_p]:mb-6',
    loose: '[&_p]:mb-8',
  }

  // Drop cap style classes
  const dropCapClasses: Record<string, string> = {
    serif: 'font-serif',
    'sans-serif': 'font-sans',
    decorative: 'font-serif italic',
  }

  // Build section classes with background
  const sectionClasses = buildSectionClasses(
    'py-16 px-4 @md:py-24',
    { backgroundColor, className }
  )

  // Drop cap CSS (applied via first-letter pseudo-element)
  const contentWithDropCap = showDropCap
    ? `[&>p:first-of-type]:first-letter:float-left [&>p:first-of-type]:first-letter:text-7xl [&>p:first-of-type]:first-letter:font-bold [&>p:first-of-type]:first-letter:mr-3 [&>p:first-of-type]:first-letter:mt-1 [&>p:first-of-type]:first-letter:leading-none [&>p:first-of-type]:first-letter:${dropCapClasses[dropCapStyle]}`
    : ''

  // Divider component
  const Divider = () => {
    if (!showDividers) return null

    const dividerContent: Record<string, React.ReactNode> = {
      line: <hr className="border-t border-gray-300 dark:border-gray-700" />,
      dots: (
        <div className="text-center text-gray-400 dark:text-gray-600 text-2xl tracking-[0.5em]">
          •••
        </div>
      ),
      asterisks: (
        <div className="text-center text-gray-400 dark:text-gray-600 text-xl tracking-widest">
          * * *
        </div>
      ),
    }

    return (
      <div className="my-12" data-cy={sel('blocks.postContent.divider')}>
        {dividerContent[dividerStyle]}
      </div>
    )
  }

  return (
    <section id={id} className={sectionClasses} data-cy={sel('blocks.postContent.container')}>
      <div className="container mx-auto">
        {/* Optional Section Title */}
        {title && (
          <div className={cn('mb-12 text-center', maxWidthClasses[maxWidth], 'mx-auto')}>
            <h2 className="text-4xl font-bold @md:text-5xl @lg:text-6xl tracking-tight">
              {title}
            </h2>
          </div>
        )}

        {/* Rich Text Article Content - Editorial Typography */}
        <article
          className={cn(
            // Base typography
            'prose prose-lg dark:prose-invert',
            // Max width for optimal reading
            maxWidthClasses[maxWidth],
            'mx-auto',
            // Font size
            fontSizeClasses[fontSize],
            // Line height
            lineHeightClasses[lineHeight],
            // Paragraph spacing
            paragraphSpacingClasses[paragraphSpacing],
            // Drop cap
            contentWithDropCap,
            // Enhanced prose styling for editorial content
            'prose-headings:font-bold prose-headings:tracking-tight',
            'prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6',
            'prose-h3:text-2xl prose-h3:mt-10 prose-h3:mb-4',
            'prose-h4:text-xl prose-h4:mt-8 prose-h4:mb-3',
            // Links
            'prose-a:text-primary prose-a:no-underline prose-a:font-medium hover:prose-a:underline',
            // Blockquotes (pull quotes)
            'prose-blockquote:border-l-4 prose-blockquote:border-primary',
            'prose-blockquote:pl-6 prose-blockquote:italic',
            'prose-blockquote:text-xl prose-blockquote:leading-relaxed',
            'prose-blockquote:my-8',
            // Lists
            'prose-ul:my-6 prose-ol:my-6',
            'prose-li:my-2',
            // Images
            'prose-img:rounded-lg prose-img:shadow-lg',
            'prose-img:my-8',
            // Code
            'prose-code:bg-gray-100 dark:prose-code:bg-gray-800',
            'prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded',
            'prose-code:text-sm',
            // Pre/code blocks
            'prose-pre:bg-gray-900 prose-pre:text-gray-100',
            'prose-pre:rounded-lg prose-pre:my-6',
            // Strong/bold
            'prose-strong:font-semibold prose-strong:text-gray-900 dark:prose-strong:text-gray-100',
            // Em/italic
            'prose-em:italic'
          )}
          dangerouslySetInnerHTML={{ __html: content }}
        />

        {/* Optional Divider after content */}
        {showDividers && <Divider />}

        {/* Optional CTA */}
        {cta && (
          <div className={cn('mt-12 text-center', maxWidthClasses[maxWidth], 'mx-auto')}>
            <a
              href={cta.link}
              target={cta.target}
              rel={cta.target === '_blank' ? 'noopener noreferrer' : undefined}
              className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-md hover:shadow-lg"
              data-cy={sel('blocks.postContent.cta')}
            >
              {cta.text}
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
