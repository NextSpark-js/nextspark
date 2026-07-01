/**
 * Shared client-side Mermaid rendering.
 *
 * Turns <pre class="mermaid"> markers (which carry the raw diagram source as
 * their text content) into inline SVG, and enforces responsive sizing so
 * diagrams never overflow. Used by every Core markdown surface — the docs HTML
 * pipeline (DocsContent), the React-based MarkdownViewer, and the API docs
 * modal — so they all render mermaid identically.
 */

// mermaid is heavy; load it lazily once per document.
let mermaidPromise: Promise<any> | null = null

function getMermaid(): Promise<any> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => mod.default)
  }
  return mermaidPromise
}

/**
 * Pick a mermaid theme that matches the app's current light/dark mode, so
 * diagrams don't render as a washed-out light graphic on a dark surface (or
 * vice-versa). Falls back to the OS preference, then light.
 */
function resolveTheme(): 'dark' | 'default' {
  if (typeof document !== 'undefined') {
    const el = document.documentElement
    if (el.classList.contains('dark')) return 'dark'
    if (el.classList.contains('light')) return 'default'
    const attr = el.getAttribute('data-theme')
    if (attr === 'dark') return 'dark'
    if (attr === 'light') return 'default'
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default'
  }
  return 'default'
}

/**
 * Render the given <pre class="mermaid"> nodes to SVG. Nodes mermaid has already
 * processed are skipped, so this is safe to call repeatedly.
 */
export async function renderMermaid(nodes: HTMLElement[]): Promise<void> {
  const pending = nodes.filter((node) => node.getAttribute('data-processed') !== 'true')
  if (pending.length === 0) return

  const mermaid = await getMermaid()
  // Re-initialize per render so the theme tracks the current light/dark mode.
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: resolveTheme(),
  })
  // suppressErrors keeps one invalid diagram from aborting the rest.
  await mermaid.run({ nodes: pending, suppressErrors: true })

  for (const node of pending) {
    const svg = node.querySelector('svg')
    if (svg) {
      svg.style.maxWidth = '100%'
      svg.style.height = 'auto'
    }
  }
}
