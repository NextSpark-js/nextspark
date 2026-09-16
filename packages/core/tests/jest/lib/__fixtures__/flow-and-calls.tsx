/** Values that do or do not reach a tag, and tags a call returns, for base-path.in-app-urls.test.ts. Never imported by the app. */
import Image from 'next/image'
import Link from 'next/link'
import { forwardRef, memo, type ElementType } from 'react'
import { AvatarImage as SharedAvatarImage } from '@nextsparkjs/ui'
import { AvatarImage } from '../../../../src/components/ui/avatar'
import { withBasePath } from '../../../../src/lib/base-path'

function identity<T>(value: T): T {
  return value
}

export function GenericIdentity({ cover }: { cover: string }) {
  const GenericImage = identity(Image)
  return <GenericImage src={cover} alt="" width={1} height={1} />
}

export function MemoImage({ cover }: { cover: string }) {
  const MemoImage = memo(Image)
  return <MemoImage src={cover} alt="" width={1} height={1} />
}

export function NestedMemoImage({ cover }: { cover: string }) {
  const NestedMemoImage = memo(identity(Image))
  return <NestedMemoImage src={cover} alt="" width={1} height={1} />
}

export function ConditionalCall({ cover, flag }: { cover: string; flag: boolean }) {
  const ConditionalImage = flag ? identity(Image) : 'span'
  return <ConditionalImage src={cover} />
}

export function MemoSharedAvatar({ cover }: { cover: string }) {
  const MemoSharedAvatar = memo(SharedAvatarImage)
  return <MemoSharedAvatar src={cover} />
}

export function MemoLink() {
  const MemoLink = memo(Link)
  return <MemoLink href={withBasePath('/docs')}>Docs</MemoLink>
}

export function CalledRequire({ cover }: { cover: string }) {
  const images = identity(require('next/image'))
  return <images.default src={cover} alt="" width={1} height={1} />
}

export function TryAssignment({ cover }: { cover: string }) {
  let C = Image
  try {
    C = 'span'
  } catch {}
  return <C src={cover} />
}

export function LoopAssignmentAfterUse({ cover, xs }: { cover: string; xs: unknown[] }) {
  let C = 'span'
  const out = []
  for (const x of xs) {
    out.push(<C src={cover} />)
    C = Image
  }
  return out
}

export function ClosureBeforeRender({ cover }: { cover: string }) {
  let C = 'span'
  const choose = () => {
    C = Image
  }
  choose()
  return <C src={cover} />
}

export function ReadFromAnotherFunction({ cover }: { cover: string }) {
  let C = Image
  C = 'span'
  // read in a function other than the one that declares it: every value counts
  const render = () => <C src={cover} />
  return render()
}

const Forwarded = forwardRef((props: { src: string }, ref: unknown) => <Image {...props} ref={ref} alt="" width={1} height={1} />)

export function ForwardRefInnerImage({ cover }: { cover: string }) {
  return <Forwarded src={cover} />
}

export function OverwrittenBeforeUse({ src }: { src: string }) {
  let Component = Image
  Component = 'span'
  return <Component src={src} />
}

export function UnionBranches({ cover, flag }: { cover: string; flag: boolean }) {
  let Tag: ElementType = Image
  if (flag) Tag = 'span'
  else Tag = 'a'
  return <Tag src={cover} />
}

export function LoopOverwrittenBeforeUse({ cover, xs }: { cover: string; xs: unknown[] }) {
  let C = Image
  const out = []
  for (const x of xs) {
    C = 'span'
    out.push(<C src={cover} />)
  }
  return out
}

export function ReturnedBranch({ cover, flag }: { cover: string; flag: boolean }) {
  let C = Image
  if (flag) {
    C = 'span'
  } else {
    return null
  }
  return <C src={cover} />
}

export function AssignedAfterRender({ cover }: { cover: string }) {
  let C = 'span'
  const el = <C src={cover} />
  C = Image
  return el
}

export function MemoCoreAvatar({ cover }: { cover: string }) {
  const MemoCoreAvatar = memo(AvatarImage)
  return <MemoCoreAvatar src={cover} />
}

export function MembersOfALocalModule({ cover }: { cover: string }) {
  const ByKey = require('./reexported-loaders')['AliasedImage']
  const { AliasedImage: Destructured } = require('./reexported-loaders')
  return (
    <>
      <ByKey src={cover} />
      <Destructured src={cover} />
    </>
  )
}

export function ArgumentOverwrittenBeforeTheCall({ cover }: { cover: string }) {
  let Base = Image
  Base = 'span'
  const Wrapped = identity(Base)
  return <Wrapped src={cover} />
}

export function LiteralArgument() {
  const Anchor = identity('a')
  return <Anchor href="/pricing">Pricing</Anchor>
}

let ModuleLevel: ElementType = Image
ModuleLevel = 'span'
export const moduleLevelElement = <ModuleLevel src="/brand/logo.png" />
