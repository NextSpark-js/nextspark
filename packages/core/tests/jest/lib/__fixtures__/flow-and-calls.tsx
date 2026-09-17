/** Tags whose type a call or TypeScript's narrowing decides, for base-path.in-app-urls.test.ts. Never imported by the app. */
import Image from 'next/image'
import Link from 'next/link'
import { forwardRef, memo, type ComponentType, type ElementType, type ReactNode } from 'react'
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
  let C: typeof Image | 'span' = Image
  try {
    C = 'span'
  } catch {}
  return <C src={cover} />
}

export function LoopAssignmentAfterUse({ cover, xs }: { cover: string; xs: unknown[] }) {
  let C: typeof Image | 'span' = 'span'
  const out = []
  for (const _ of xs) {
    out.push(<C src={cover} />)
    C = Image
  }
  return out
}

export function ClosureBeforeRender({ cover }: { cover: string }) {
  let C: typeof Image | 'span' = 'span'
  const choose = () => {
    C = Image
  }
  choose()
  return <C src={cover} />
}

export function ReadInAClosureBeforeTheLastAssignment({ cover }: { cover: string }) {
  let C: typeof Image | 'span' = 'span'
  // read in a closure made before the variable's last assignment: its declared type
  const render = () => <C src={cover} />
  C = Image
  return render()
}

const Forwarded = forwardRef((props: { src: string }, ref: unknown) => <Image {...props} ref={ref} alt="" width={1} height={1} />)

export function ForwardRefInnerImage({ cover }: { cover: string }) {
  return <Forwarded src={cover} />
}

export function OverwrittenBeforeUse({ src }: { src: string }) {
  let Component: typeof Image | 'span' = Image
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
  let C: typeof Image | 'span' = Image
  const out = []
  for (const _ of xs) {
    C = 'span'
    out.push(<C src={cover} />)
  }
  return out
}

export function ReturnedBranch({ cover, flag }: { cover: string; flag: boolean }) {
  let C: typeof Image | 'span' = Image
  if (flag) {
    C = 'span'
  } else {
    return null
  }
  return <C src={cover} />
}

export function AssignedAfterRender({ cover }: { cover: string }) {
  let C: typeof Image | 'span' = 'span'
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
  let Base: typeof Image | 'span' = Image
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

const Loader = Image
function Sink(_props: { src: string; alt: string; width: number; height: number }) {
  return null
}
function second<A, B>(_discarded: A, result: B): B {
  return result
}
function makeLoader() {
  return Loader
}
function defaultLoader(value = Loader) {
  return value
}
function safeLink<P>(_Component: ComponentType<P>) {
  return function SafeLink(props: { href: string; children?: ReactNode }) {
    return <a href={withBasePath(props.href)}>{props.children}</a>
  }
}

export function DiscardedArgument({ cover }: { cover: string }) {
  const C = second(Loader, Sink)
  return <C src={cover} alt="" width={1} height={1} />
}

export function NoArgumentReturn({ cover }: { cover: string }) {
  const C = makeLoader()
  return <C src={cover} alt="" width={1} height={1} />
}

export function DefaultArgumentReturn({ cover }: { cover: string }) {
  const C = defaultLoader()
  return <C src={cover} alt="" width={1} height={1} />
}

const SafeLink = safeLink(Link)
export function ReturnedWrapper() {
  return <SafeLink href="/docs">Docs</SafeLink>
}

export function BranchAliasImageFirst({ cover, flag }: { cover: string; flag: boolean }) {
  let Base: typeof Loader | typeof Sink = Loader
  let C: typeof Loader | typeof Sink
  if (flag) C = Base
  else {
    Base = Sink
    C = Base
  }
  return <C src={cover} alt="" width={1} height={1} />
}

export function BranchAliasImageSecond({ cover, flag }: { cover: string; flag: boolean }) {
  let Base: typeof Loader | typeof Sink = Loader
  let C: typeof Loader | typeof Sink
  if (flag) {
    Base = Sink
    C = Base
  } else C = Base
  return <C src={cover} alt="" width={1} height={1} />
}

export function ClosureOverwritesBeforeUse({ cover }: { cover: string }) {
  let C: typeof Loader | typeof Sink = Loader
  const overwrite = () => {
    C = Sink
  }
  overwrite()
  return <C src={cover} alt="" width={1} height={1} />
}

export function ClosureAssignsAfterUse({ cover }: { cover: string }) {
  let C: typeof Loader | typeof Sink = Sink
  const assign = () => {
    C = Loader
  }
  const element = <C src={cover} alt="" width={1} height={1} />
  assign()
  return element
}
