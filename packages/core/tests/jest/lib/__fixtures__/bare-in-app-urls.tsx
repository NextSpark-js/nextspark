/** Shapes base-path.in-app-urls.test.ts has to catch. Never imported by the app. */
import NextImage, { type ImageProps } from 'next/image'
import { default as Picture } from 'next/image'
import { Image } from 'lucide-react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { AvatarImage as SharedAvatarImage } from '@nextsparkjs/ui'
import { withBasePath, withBasePathIfInApp } from '../../../../src/lib/base-path'
import { sanitizeBlockHtml } from '../../../../src/lib/blocks/sanitize-html'
import { AvatarImage } from '../../../../src/components/ui/avatar'
import { ReexportedImage, ReexportedAvatarImage, AliasedImage, AliasedAvatarImage } from './reexported-loaders'

const RequiredImage = require('next/image').default

export async function viaVariable(slug: string) {
  const path = `/api/v1/${slug}`
  return fetch(path)
}

export async function multiLine() {
  return fetch(
    '/api/v1/teams'
  )
}

export function navigate() {
  window.location.href = '/dashboard'
}

export async function wrapped() {
  const path = '/api/v1/teams'
  await fetch(withBasePath(path))
  await fetch(withBasePath('/api/v1/teams'))
  return new URL(withBasePath('/api/v1/teams'), window.location.origin)
}

export function deepLink(id: string) {
  window.history.pushState(null, '', `/dashboard/boards/${id}`)
  window.open('/dashboard/reports')
}

export function Links({ href }: { href: string }) {
  return (
    <>
      <a href="/pricing">Pricing</a>
      <a href={withBasePath('/dashboard')}>Dashboard</a>
      <a href={href}>Wherever</a>
      <a href="https://example.com/pricing">Elsewhere</a>
    </>
  )
}

export async function elsewhere() {
  return fetch('https://example.com/api/v1/teams')
}

export function Assets({ url, thumbnail }: { url: string; thumbnail: string }) {
  return (
    <>
      <img src={thumbnail} alt="" />
      <img src={withBasePathIfInApp(url)} alt="" />
      <img src="/theme/blocks/hero/thumbnail.png" alt="" />
      <a href={url}>Wherever</a>
      <a href={`mailto:${url}`}>Mail</a>
      <iframe src={url} />
    </>
  )
}

export function Embedded({ body }: { body: string }) {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: body }} />
      <div dangerouslySetInnerHTML={{ __html: sanitizeBlockHtml(body) }} />
    </>
  )
}

export function openDynamic(url: string) {
  window.open(url, '_blank')
}

export function Pictures({ cover, avatar, rest }: { cover: string; avatar: string; rest: ImageProps }) {
  return (
    <>
      <NextImage src={cover} alt="" width={10} height={10} />
      <NextImage src={withBasePathIfInApp(avatar)} alt="" width={10} height={10} />
      <NextImage src="/brand/logo.png" alt="" width={10} height={10} />
      <NextImage {...rest} />
      <Image className="h-4 w-4" />
    </>
  )
}

export function Backgrounds({ upload }: { upload: string }) {
  return (
    <>
      <div style={{ backgroundImage: `url(${upload})` }} />
      <div style={{ backgroundImage: `url('${withBasePathIfInApp(upload)}')` }} />
      <div style={{ backgroundImage: 'url(/theme/hero.jpg)' }} />
      <div style={{ backgroundImage: `linear-gradient(red, blue), url("${upload}")` }} />
      <div style={{ backgroundImage: 'url(https://cdn.example.com/hero.jpg)' }} />
    </>
  )
}

export function ImagesImportedOtherwise({ cover }: { cover: string }) {
  return (
    <>
      <Picture src={cover} alt="" width={10} height={10} />
      <RequiredImage src={cover} alt="" width={10} height={10} />
      <ReexportedImage src={cover} alt="" width={10} height={10} />
    </>
  )
}

export function Avatars({ avatar }: { avatar: string }) {
  return (
    <>
      <AvatarPrimitive.Image src={avatar} />
      <SharedAvatarImage src={avatar} />
      <ReexportedAvatarImage src={avatar} />
      <SharedAvatarImage src={avatar && withBasePathIfInApp(avatar)} />
      {/* core's AvatarImage puts the base path on */}
      <AvatarImage src={avatar} />
    </>
  )
}

export function Thumbnail({ cover, ...props }: { cover: string } & React.ComponentProps<'img'>) {
  return (
    <>
      <img {...props} />
      <img src={withBasePathIfInApp(cover)} alt="" {...props} />
      <img src={withBasePathIfInApp(cover)} srcSet={cover} alt="" {...props} />
    </>
  )
}

export function Concatenated({ upload }: { upload: string }) {
  return (
    <>
      <div style={{ backgroundImage: 'url(' + upload + ')' }} />
      <div style={{ backgroundImage: "linear-gradient(red, blue), url('" + upload + "')" }} />
      <div style={{ backgroundImage: "url('" + withBasePathIfInApp(upload) + "')" }} />
      <div style={{ width: 'calc(' + upload + ')' }} />
    </>
  )
}

const LocalImage = Picture as typeof Picture

export function Aliased({ cover }: { cover: string }) {
  return (
    <>
      <AliasedImage src={cover} alt="" width={10} height={10} />
      <AliasedAvatarImage src={cover} />
      <LocalImage src={cover} alt="" width={10} height={10} />
    </>
  )
}

import { Slot } from '@radix-ui/react-slot'

const RequiredAvatarImage = require('@radix-ui/react-avatar').Image
const RequiredByKey = require('next/image')['default']

export function RequiredMembers({ avatar }: { avatar: string }) {
  return (
    <>
      <RequiredAvatarImage src={avatar} />
      <RequiredByKey src={avatar} alt="" width={10} height={10} />
    </>
  )
}

export const ChosenAnchor = ({ asChild, ...props }: { asChild?: boolean } & React.ComponentProps<'a'>) => {
  const Comp = asChild ? Slot : 'a'
  return <Comp {...props} />
}

export function ChosenMedia({ as: Tag = 'img', cover, ...props }: { as?: 'img' | 'video'; cover: string }) {
  const Picture = cover.endsWith('.svg') ? 'img' : NextImage
  return (
    <>
      <Tag src={cover} {...props} />
      <Picture src={cover} alt="" width={10} height={10} />
    </>
  )
}

export function ChosenWithFallback({ as, href }: { as?: 'a' | 'span'; href: string }) {
  const Tag = as ?? 'a'
  const LocalRequired = require('@radix-ui/react-avatar').Image
  return (
    <>
      <Tag href={href}>Docs</Tag>
      <LocalRequired src={href} />
    </>
  )
}

export function ChosenButton({ asChild, ...props }: { asChild?: boolean } & React.ComponentProps<'button'>) {
  const Comp = asChild ? Slot : 'button'
  return <Comp {...props} />
}

export function Shadowed({ NextImage }: { NextImage: React.ComponentType<{ src: string }> }) {
  return <NextImage src="/brand/logo.png" />
}

export function Reassigned({ external }: { external: boolean }) {
  let Comp: 'a' | 'span' = 'span'
  if (external) Comp = 'a'
  return <Comp href="/pricing">Pricing</Comp>
}

export function AssignedIfUnset({ as, fallback }: { as?: 'span'; fallback?: 'span' }) {
  let Comp: 'a' | 'span' | undefined = as
  Comp ||= 'a'
  let Other: 'a' | 'span' | undefined = fallback
  Other ??= 'a'
  return (
    <>
      <Comp href="/pricing">Pricing</Comp>
      <Other href="/pricing">Pricing</Other>
    </>
  )
}

export function DeclaredInLoops({ cover }: { cover: string }) {
  const media = []
  for (const Media of ['img', 'video'] as const) media.push(<Media src={cover} />)
  for (const { default: LoopImage } of [require('next/image')]) media.push(<LoopImage src={cover} alt="" width={1} height={1} />)
  for (let Tag = 'a' as const; ; ) {
    return <Tag href="/pricing">{media}</Tag>
  }
}

export function RequiredInside({ cover }: { cover: string }) {
  const { default: DestructuredImage } = require('next/image')
  const images = require('next/image')
  const AliasedDefault = images.default
  const { default: FromAlias } = images
  return (
    <>
      <DestructuredImage src={cover} alt="" width={10} height={10} />
      <AliasedDefault src={cover} alt="" width={10} height={10} />
      <FromAlias src={cover} alt="" width={10} height={10} />
      <images.default src={cover} alt="" width={10} height={10} />
    </>
  )
}

export function ShadowedInside({ external }: { external: boolean }) {
  const Comp = 'span'
  const pick = () => {
    let Comp = 'div'
    Comp = 'a'
    return Comp
  }
  let Chosen: 'a' | 'span' = 'span'
  const choose = () => {
    Chosen = 'a'
  }
  if (external) choose()
  return (
    <>
      <Comp href="/pricing">{pick()}</Comp>
      <Chosen href="/pricing">Pricing</Chosen>
    </>
  )
}

import Link from 'next/link'

export function PrefixedTwice({ href }: { href: string }) {
  return (
    <>
      <Link href={withBasePathIfInApp('/docs')}>Docs</Link>
      <Link href={{ pathname: withBasePath('/docs') }}>Docs</Link>
      <Link href="/docs">Docs</Link>
      <Link href={href}>Docs</Link>
      <a href={withBasePathIfInApp('/docs')}>Docs</a>
    </>
  )
}
