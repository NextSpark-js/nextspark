import { cn } from '../../lib/utils'

interface SocialIconProps {
  className?: string
  'data-cy'?: string
}

/** GitHub's mark, in the current text color so it follows the theme. */
export function GitHubIcon({ className, 'data-cy': dataCy }: SocialIconProps) {
  return (
    <svg className={cn('h-4 w-4', className)} viewBox="0 0 24 24" aria-hidden="true" data-cy={dataCy} fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  )
}

/** Microsoft's four squares, in the brand colors (they read on light and dark backgrounds). */
export function MicrosoftIcon({ className, 'data-cy': dataCy }: SocialIconProps) {
  return (
    <svg className={cn('h-4 w-4', className)} viewBox="0 0 24 24" aria-hidden="true" data-cy={dataCy}>
      <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
      <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
      <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
      <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
    </svg>
  )
}

/** Apple's logo, in the current text color so it follows the theme. */
export function AppleIcon({ className, 'data-cy': dataCy }: SocialIconProps) {
  return (
    <svg className={cn('h-4 w-4', className)} viewBox="0 0 24 24" aria-hidden="true" data-cy={dataCy} fill="currentColor">
      <path d="M16.37 12.74c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-2.99-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.39-.92-2.4-3.66zM14.1 5.98c.63-.77 1.06-1.83.94-2.89-.91.04-2.02.61-2.67 1.37-.58.67-1.1 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.28z" />
    </svg>
  )
}

/** The icon of each built-in provider other than Google (components/ui/google-icon). */
export const SOCIAL_ICONS = {
  github: GitHubIcon,
  microsoft: MicrosoftIcon,
  apple: AppleIcon,
} as const
