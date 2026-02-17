/**
 * Page Template Generator
 *
 * Generates React server component files (page.tsx) from PageDefinition blocks.
 * Each block type is rendered as a <section> with props-driven content.
 *
 * Used by:
 * - /api/pages (auto-save from Page Editor)
 * - create_page chat tool
 * - Post-generation hook after initial project generation
 */

import type { PageDefinition, BlockInstance } from '../types'

// ── Block renderers ─────────────────────────────────────────────────

function escapeJsx(text: unknown): string {
  if (typeof text !== 'string') return String(text ?? '')
  // Only escape characters that break JSX: curly braces (interpreted as expressions)
  // and angle brackets (interpreted as tags). Dollar signs, backticks, etc. are fine in JSX text.
  return text
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
}

function e(text: unknown): string {
  return escapeJsx(text)
}

/**
 * Render a CTA button pair.
 */
function renderCta(props: Record<string, unknown>, indent: string): string {
  const lines: string[] = []
  const cta = props.cta as Record<string, string> | undefined
  const secondary = props.secondaryButton as Record<string, string> | undefined

  if (cta?.text) {
    lines.push(`${indent}<div className="mt-10 flex flex-wrap gap-4 justify-center">`)
    lines.push(`${indent}  <a href="${e(cta.link || '/auth/sign-up')}" className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">`)
    lines.push(`${indent}    ${e(cta.text)}`)
    lines.push(`${indent}  </a>`)
    if (secondary?.text) {
      lines.push(`${indent}  <a href="${e(secondary.link || '#')}" className="rounded-lg border border-border px-8 py-3 text-sm font-semibold text-foreground hover:bg-accent transition-colors">`)
      lines.push(`${indent}    ${e(secondary.text)}`)
      lines.push(`${indent}  </a>`)
    }
    lines.push(`${indent}</div>`)
  }
  return lines.join('\n')
}

/**
 * Generate JSX for a single block instance.
 */
function renderBlock(block: BlockInstance, _index: number): string {
  const p = block.props
  const type = block.blockType

  switch (type) {
    case 'hero':
    case 'jumbotron':
    case 'video-hero':
      return `      {/* ${e(p.title || 'Hero')} */}
      <section className="flex flex-col items-center justify-center px-4 py-24 text-center${p.fullscreen ? ' min-h-screen' : ''}">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          ${e(p.title || 'Welcome')}
        </h1>
${p.content ? `        <p className="mt-6 text-lg text-muted-foreground max-w-2xl">\n          ${e(p.content)}\n        </p>` : ''}
${renderCta(p, '        ')}
      </section>`

    case 'hero-with-form':
      return `      {/* ${e(p.title || 'Hero with Form')} */}
      <section className="flex flex-col lg:flex-row items-center justify-between gap-12 px-4 py-24 max-w-6xl mx-auto">
        <div className="flex-1 text-center lg:text-left">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            ${e(p.title || 'Welcome')}
          </h1>
${p.content ? `          <p className="mt-6 text-lg text-muted-foreground max-w-xl">\n            ${e(p.content)}\n          </p>` : ''}
        </div>
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
          <p className="text-sm text-muted-foreground text-center">Sign up form placeholder</p>
        </div>
      </section>`

    case 'features-grid':
    case 'benefits':
      return renderFeaturesGrid(p)

    case 'split-content':
      return renderSplitContent(p)

    case 'pricing-table':
      return renderPricingTable(p)

    case 'testimonials':
      return renderTestimonials(p)

    case 'stats-counter':
      return renderStatsCounter(p)

    case 'faq-accordion':
      return renderFaq(p)

    case 'cta-section':
      return `      {/* ${e(p.title || 'CTA')} */}
      <section className="px-4 py-24 text-center bg-primary/5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold">${e(p.title || 'Get Started')}</h2>
${p.content ? `          <p className="mt-4 text-lg text-muted-foreground">\n            ${e(p.content)}\n          </p>` : ''}
${renderCta(p, '          ')}
        </div>
      </section>`

    case 'text-content':
    case 'post-content':
      return `      {/* ${e(p.title || 'Content')} */}
      <section className="px-4 py-24">
        <div className="max-w-3xl mx-auto prose prose-neutral dark:prose-invert">
${p.title ? `          <h2>${e(p.title)}</h2>` : ''}
${p.content ? `          <p>${e(p.content)}</p>` : ''}
        </div>
      </section>`

    case 'timeline':
      return renderTimeline(p)

    case 'logo-cloud':
      return `      {/* ${e(p.title || 'Trusted By')} */}
      <section className="px-4 py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">${e(p.title || 'Trusted by leading companies')}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-8 opacity-60">
          ${Array.isArray(p.items) ? (p.items as Array<Record<string, string>>).map(item => `<span className="text-lg font-semibold">${e(item.name || item.title || '●')}</span>`).join('\n          ') : '<span className="text-muted-foreground">Partner logos</span>'}
        </div>
      </section>`

    default:
      return `      {/* Block: ${e(type)} */}
      <section className="px-4 py-24">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-bold">${e(p.title || type)}</h2>
${p.content ? `          <p className="mt-4 text-muted-foreground">${e(p.content)}</p>` : ''}
        </div>
      </section>`
  }
}

function renderFeaturesGrid(p: Record<string, unknown>): string {
  const items = Array.isArray(p.items) ? p.items as Array<Record<string, string>> : []
  const cols = Number(p.columns) || 3

  return `      {/* ${e(p.title || 'Features')} */}
      <section className="px-4 py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center">${e(p.title || 'Features')}</h2>
${p.content ? `          <p className="mt-4 text-center text-muted-foreground max-w-2xl mx-auto">\n            ${e(p.content)}\n          </p>` : ''}
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-${cols}">
${items.map(item => `            <div className="rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">✦</div>
              <h3 className="font-semibold">${e(item.title || '')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">${e(item.description || '')}</p>
            </div>`).join('\n')}
          </div>
        </div>
      </section>`
}

function renderSplitContent(p: Record<string, unknown>): string {
  const imgPos = p.imagePosition || 'right'
  const flexDir = imgPos === 'left' ? 'lg:flex-row-reverse' : 'lg:flex-row'

  return `      {/* ${e(p.title || 'Split Content')} */}
      <section className="px-4 py-24">
        <div className="max-w-6xl mx-auto flex flex-col ${flexDir} items-center gap-12">
          <div className="flex-1">
            <h2 className="text-3xl font-bold">${e(p.title || '')}</h2>
${p.content ? `            <p className="mt-4 text-muted-foreground leading-relaxed">\n              ${e(p.content)}\n            </p>` : ''}
${renderCta(p, '            ')}
          </div>
          <div className="flex-1 w-full">
${p.image ? `            <img src="${e(p.image)}" alt="${e(p.title || '')}" className="rounded-xl shadow-lg w-full object-cover" />` : `            <div className="aspect-video rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground">Image placeholder</div>`}
          </div>
        </div>
      </section>`
}

function renderPricingTable(p: Record<string, unknown>): string {
  const plans = Array.isArray(p.plans) ? p.plans as Array<Record<string, unknown>> : []
  const cols = Math.min(plans.length || 3, 4)

  return `      {/* ${e(p.title || 'Pricing')} */}
      <section className="px-4 py-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center">${e(p.title || 'Pricing')}</h2>
${p.content ? `          <p className="mt-4 text-center text-muted-foreground">${e(p.content)}</p>` : ''}
          <div className="mt-16 grid gap-8 lg:grid-cols-${cols}">
${plans.map(plan => {
  const features = typeof plan.features === 'string'
    ? (plan.features as string).split('\n').filter(Boolean)
    : Array.isArray(plan.features) ? plan.features as string[] : []
  return `            <div className="relative rounded-xl border ${plan.isPopular ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'border-border shadow-sm'} bg-card p-8 flex flex-col">
${plan.isPopular ? `              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Most Popular</span>` : ''}
              <h3 className="text-xl font-bold">${e(plan.name || '')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">${e(plan.description || '')}</p>
              <div className="mt-6">
                <span className="text-4xl font-bold">${e(plan.price || '$0')}</span>
                <span className="text-muted-foreground">/${e(plan.period || 'month')}</span>
              </div>
              <ul className="mt-8 space-y-3 flex-1">
${features.map(f => `                <li className="flex items-center gap-2 text-sm"><span className="text-primary">✓</span> ${e(f)}</li>`).join('\n')}
              </ul>
              <a href="${e(plan.ctaUrl || '/auth/sign-up')}" className="mt-8 block rounded-lg ${plan.isPopular ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-border hover:bg-accent'} px-6 py-3 text-center text-sm font-semibold transition-colors">
                ${e(plan.ctaText || 'Get Started')}
              </a>
            </div>`}).join('\n')}
          </div>
        </div>
      </section>`
}

function renderTestimonials(p: Record<string, unknown>): string {
  const items = Array.isArray(p.items) ? p.items as Array<Record<string, string>> : []
  const cols = Number(p.columns) || 3

  return `      {/* ${e(p.title || 'Testimonials')} */}
      <section className="px-4 py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center">${e(p.title || 'What Our Users Say')}</h2>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-${cols}">
${items.map(item => `            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <p className="text-sm text-muted-foreground italic">&ldquo;${e(item.quote || '')}&rdquo;</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">${e((item.author || 'A')[0])}</div>
                <div>
                  <p className="text-sm font-semibold">${e(item.author || '')}</p>
                  <p className="text-xs text-muted-foreground">${e(item.role || '')}</p>
                </div>
              </div>
            </div>`).join('\n')}
          </div>
        </div>
      </section>`
}

function renderStatsCounter(p: Record<string, unknown>): string {
  const items = Array.isArray(p.items) ? p.items as Array<Record<string, string>> : []

  return `      {/* ${e(p.title || 'Stats')} */}
      <section className="px-4 py-16 border-y bg-card">
        <div className="max-w-6xl mx-auto text-center">
${p.title ? `          <h2 className="text-xl font-semibold text-muted-foreground mb-12">${e(p.title)}</h2>` : ''}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
${items.map(item => `            <div>
              <div className="text-3xl font-bold">${e(item.value || '0')}${item.suffix ? e(item.suffix) : ''}</div>
              <div className="mt-1 text-sm text-muted-foreground">${e(item.label || '')}</div>
            </div>`).join('\n')}
          </div>
        </div>
      </section>`
}

function renderFaq(p: Record<string, unknown>): string {
  const items = Array.isArray(p.items) ? p.items as Array<Record<string, string>> : []

  return `      {/* ${e(p.title || 'FAQ')} */}
      <section className="px-4 py-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center">${e(p.title || 'FAQ')}</h2>
${p.subtitle ? `          <p className="mt-4 text-center text-muted-foreground">${e(p.subtitle)}</p>` : ''}
          <div className="mt-12 space-y-4">
${items.map(item => `            <details className="group rounded-lg border bg-card">
              <summary className="flex cursor-pointer items-center justify-between p-4 font-medium">
                ${e(item.question || '')}
                <span className="ml-2 transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="px-4 pb-4 text-sm text-muted-foreground">
                ${e(item.answer || '')}
              </div>
            </details>`).join('\n')}
          </div>
        </div>
      </section>`
}

function renderTimeline(p: Record<string, unknown>): string {
  const items = Array.isArray(p.items) ? p.items as Array<Record<string, string>> : []

  return `      {/* ${e(p.title || 'Timeline')} */}
      <section className="px-4 py-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center">${e(p.title || 'Timeline')}</h2>
          <div className="mt-12 space-y-8 relative before:absolute before:left-4 before:top-0 before:h-full before:w-0.5 before:bg-border">
${items.map(item => `            <div className="relative pl-12">
              <div className="absolute left-2.5 top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background"></div>
              <h3 className="font-semibold">${e(item.title || '')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">${e(item.description || item.content || '')}</p>
            </div>`).join('\n')}
          </div>
        </div>
      </section>`
}

// ── Main generator ──────────────────────────────────────────────────

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
}

/**
 * Generate the full page.tsx file content for a page definition.
 */
export function generatePageTemplate(page: PageDefinition): string {
  const sortedBlocks = [...page.blocks].sort((a, b) => a.order - b.order)
  const componentName = page.route === '/'
    ? 'HomePage'
    : `${toPascalCase(page.pageName)}Page`

  const blockSections = sortedBlocks
    .map((block, i) => renderBlock(block, i))
    .join('\n\n')

  return `export default function ${componentName}() {
  return (
    <main className="flex min-h-screen flex-col">
${blockSections}
    </main>
  )
}
`
}

/**
 * Generate page templates for all pages in a project.
 * Returns a map of { route: templateContent }.
 */
export function generateAllPageTemplates(pages: PageDefinition[]): Map<string, string> {
  const result = new Map<string, string>()
  for (const page of pages) {
    result.set(page.route, generatePageTemplate(page))
  }
  return result
}

/**
 * Get the template file path for a given page route within a theme.
 */
export function getTemplateFilePath(route: string, themeName: string): string {
  if (route === '/') {
    return `contents/themes/${themeName}/templates/(public)/page.tsx`
  }
  // /pricing → contents/themes/{theme}/templates/(public)/pricing/page.tsx
  const segments = route.replace(/^\//, '').replace(/\/$/, '')
  return `contents/themes/${themeName}/templates/(public)/${segments}/page.tsx`
}
