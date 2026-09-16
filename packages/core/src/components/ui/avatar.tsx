import * as React from 'react'
import { AvatarImage as SharedAvatarImage, type AvatarImageProps } from '@nextsparkjs/ui'
import { withBasePathIfInApp } from '../../lib/base-path'

// Re-export from shared package for web/mobile compatibility
export {
  Avatar,
  AvatarFallback,
  getInitials,
  type AvatarProps,
  type AvatarImageProps,
  type AvatarFallbackProps,
} from '@nextsparkjs/ui'

/**
 * The shared AvatarImage with the base path on an in-app `src`.
 *
 * An avatar's URL is data: a file uploaded under /uploads, or a sign-in
 * provider's https URL. The shared component, which mobile uses too, hands its
 * `src` to the browser as given, and under a base path an upload asked for
 * without it is a 404 that leaves only the initials showing.
 *
 * `src` takes a URL only. An `<img>` also accepts a Blob, but Radix loads the
 * avatar by assigning `src` to an off-screen image, where a Blob does not load.
 */
export const AvatarImage = React.forwardRef<
  React.ElementRef<typeof SharedAvatarImage>,
  Omit<AvatarImageProps, 'src'> & { src?: string }
>(({ src, ...props }, ref) => <SharedAvatarImage ref={ref} {...props} src={src && withBasePathIfInApp(src)} />)
AvatarImage.displayName = SharedAvatarImage.displayName
