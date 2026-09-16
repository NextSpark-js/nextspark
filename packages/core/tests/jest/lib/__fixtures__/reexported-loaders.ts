/** Re-exports base-path.in-app-urls.test.ts has to follow. Never imported by the app. */
import NextImage from 'next/image'
import * as AvatarPrimitive from '@radix-ui/react-avatar'

export { default as ReexportedImage } from 'next/image'
export { AvatarImage as ReexportedAvatarImage } from '@nextsparkjs/ui'
export const AliasedImage = NextImage
export const AliasedAvatarImage = AvatarPrimitive.Image
