/** Components typed only as ComponentType, which base-path.in-app-urls.test.ts cannot tell apart. Never imported by the app. */
import Image from 'next/image'
import { memo, type ComponentType } from 'react'

type Props = { src: string; alt: string; width: number; height: number }
const Loader = Image as ComponentType<Props>
const Sink: ComponentType<Props> = () => null

function identity<T>(value: T): T {
  return value
}
function plain(value: ComponentType<Props>): ComponentType<Props> {
  return value
}
function second<A, B>(_discarded: A, result: B): B {
  return result
}
function makeLoader(): ComponentType<Props> {
  return Loader
}
function defaultLoader(value: ComponentType<Props> = Loader): ComponentType<Props> {
  return value
}

export function GenericIdentity({ src }: { src: string }) {
  const C = identity(Loader)
  return <C src={src} alt="" width={1} height={1} />
}

export function PlainIdentity({ src }: { src: string }) {
  const C = plain(Loader)
  return <C src={src} alt="" width={1} height={1} />
}

export function MemoIdentity({ src }: { src: string }) {
  const C = memo(Loader)
  return <C src={src} alt="" width={1} height={1} />
}

export function DiscardedArgument({ src }: { src: string }) {
  const C = second(Loader, Sink)
  return <C src={src} alt="" width={1} height={1} />
}

export function NoArgumentReturn({ src }: { src: string }) {
  const C = makeLoader()
  return <C src={src} alt="" width={1} height={1} />
}

export function DefaultArgumentReturn({ src }: { src: string }) {
  const C = defaultLoader()
  return <C src={src} alt="" width={1} height={1} />
}

export function OrKeepsLoader({ src }: { src: string }) {
  let C: ComponentType<Props> = Loader
  C ||= Sink
  return <C src={src} alt="" width={1} height={1} />
}

export function ClosureOverwritesBeforeUse({ src }: { src: string }) {
  let C: ComponentType<Props> = Loader
  const overwrite = () => {
    C = Sink
  }
  overwrite()
  return <C src={src} alt="" width={1} height={1} />
}

export function BranchAliasImageFirst({ src, flag }: { src: string; flag: boolean }) {
  let Base: ComponentType<Props> = Loader
  let C: ComponentType<Props>
  if (flag) C = Base
  else {
    Base = Sink
    C = Base
  }
  return <C src={src} alt="" width={1} height={1} />
}
