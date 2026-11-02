#!/usr/bin/env node
/**
 * Requests the public pages of a running NextSpark app (the starter's /, /support, /docs and /blog by default) and
 * checks the metadata in the server-rendered HTML (#365): a <title> no other page shares, a <link rel="canonical">
 * that is an absolute URL whose path is the page's own, and an og:title and an og:description with text.
 *
 * Usage: node scripts/seo/verify-public-metadata.mjs --base-url http://localhost:3000 [--path /docs ...] [--json report.json]
 * Exits 1 when any page breaks the rules.
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const DEFAULT_PATHS = ['/', '/support', '/docs', '/blog']

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find(v => v !== undefined) ?? null
const decode = text => text.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/** The title, canonical href and og tags of an HTML document (null when absent). */
export function readMetadata(html) {
  const tags = html.match(/<(?:meta|link)\s[^>]*>/gi) ?? []
  const meta = property => {
    const tag = tags.find(t => /^<meta/i.test(t) && attr(t, 'property') === property)
    return tag && attr(tag, 'content') !== null ? decode(attr(tag, 'content')) : null
  }
  const canonical = tags.find(t => /^<link/i.test(t) && attr(t, 'rel')?.toLowerCase() === 'canonical')
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return {
    title: title ? decode(title[1]).trim() : null,
    canonical: canonical ? attr(canonical, 'href') : null,
    ogTitle: meta('og:title'),
    ogDescription: meta('og:description'),
  }
}

/** The problems of the pages' metadata; `pages` is [{ path, ...readMetadata() }]. */
export function judge(pages) {
  const problems = []
  for (const page of pages) {
    const fail = message => problems.push(`${page.path}: ${message}`)
    if (!page.title) fail('no <title>')
    if (!page.ogTitle?.trim()) fail('no og:title')
    if (!page.ogDescription?.trim()) fail('no og:description')
    if (!page.canonical) fail('no canonical link')
    else {
      let url = null
      try {
        url = new URL(page.canonical)
      } catch {
        fail(`canonical ${JSON.stringify(page.canonical)} is not an absolute URL`)
      }
      if (url && url.pathname.replace(/\/+$/, '') !== page.path.replace(/\/+$/, '')) fail(`canonical ${page.canonical} is not this page's URL`)
    }
    const twin = pages.find(other => other !== page && page.title && other.title === page.title)
    if (twin) fail(`shares the title ${JSON.stringify(page.title)} with ${twin.path}`)
  }
  return problems
}

export async function verifyPublicMetadata({ baseUrl, paths = DEFAULT_PATHS }) {
  const pages = []
  for (const path of paths) {
    const res = await fetch(new URL(path, baseUrl))
    if (res.status !== 200) throw new Error(`GET ${path} answered ${res.status}`)
    pages.push({ path, ...readMetadata(await res.text()) })
  }
  const problems = judge(pages)
  return { ok: problems.length === 0, pages, problems }
}

async function main() {
  const argv = process.argv.slice(2)
  const options = { paths: [] }
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i] === '--base-url') options.baseUrl = argv[i + 1]
    else if (argv[i] === '--path') options.paths.push(argv[i + 1])
    else if (argv[i] === '--json') options.json = argv[i + 1]
    else throw new Error(`Unknown argument ${argv[i]}`)
  }
  if (!options.baseUrl) throw new Error('--base-url is required')
  if (options.paths.length === 0) options.paths = DEFAULT_PATHS
  const result = await verifyPublicMetadata(options)
  console.log('| path | title | canonical | og:title |\n|---|---|---|---|')
  for (const page of result.pages) console.log(`| ${page.path} | ${page.title} | ${page.canonical} | ${page.ogTitle} |`)
  for (const problem of result.problems) console.error(problem)
  if (options.json) await writeFile(options.json, JSON.stringify(result, null, 2) + '\n')
  process.exitCode = result.ok ? 0 : 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
