/** Shapes base-path.in-app-urls.test.ts has to catch. Never imported by the app. */
import { withBasePath, withBasePathIfInApp } from '../../../../src/lib/base-path'
import { sanitizeBlockHtml } from '../../../../src/lib/blocks/sanitize-html'

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
