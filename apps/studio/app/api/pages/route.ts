/**
 * Pages API Route
 *
 * POST /api/pages — Apply page definitions to a generated project
 *
 * Writes page builder config to the project's theme directory.
 * Each page becomes a JSON file with block instances.
 */

import { getProjectPath } from '@/lib/project-manager'
import { existsSync, readFileSync } from 'fs'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { requireSession } from '@/lib/auth-helpers'
import { generatePageTemplate, getTemplateFilePath } from '@/lib/page-template-generator'

export const runtime = 'nodejs'

interface BlockInstance {
  blockType: string
  props: Record<string, unknown>
  order: number
}

interface PageDefinition {
  pageName: string
  route: string
  blocks: BlockInstance[]
}

export async function POST(request: Request) {
  try { await requireSession() } catch (r) { return r as Response }

  const body = await request.json()
  const { slug, pages } = body as { slug?: string; pages?: PageDefinition[] }

  if (!slug || !pages) {
    return Response.json({ error: 'slug and pages are required' }, { status: 400 })
  }

  const projectPath = getProjectPath(slug)
  if (!existsSync(projectPath)) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  // Determine the active theme from the project's .env
  let activeTheme = slug
  try {
    const envContent = readFileSync(path.join(projectPath, '.env'), 'utf-8')
    const themeMatch = envContent.match(/NEXT_PUBLIC_ACTIVE_THEME="?([^"\n]+)"?/)
    if (themeMatch) activeTheme = themeMatch[1]
  } catch {
    // fallback to slug
  }

  // Write pages to the theme's pages directory
  const pagesDir = path.join(projectPath, 'contents', 'themes', activeTheme, 'pages')
  await mkdir(pagesDir, { recursive: true })

  const results: Array<{ page: string; path: string }> = []

  for (const page of pages) {
    // Create a PageConfig-like structure matching NextSpark's format
    const pageSlug = page.route === '/'
      ? 'home'
      : page.route.replace(/^\//, '').replace(/\//g, '-')

    const pageConfig = {
      id: `page-${pageSlug}-${Date.now()}`,
      slug: pageSlug,
      title: page.pageName,
      route: page.route,
      blocks: page.blocks.map((block, index) => ({
        id: `block-${pageSlug}-${index}-${Date.now()}`,
        blockSlug: block.blockType,
        props: block.props,
        order: block.order,
      })),
      locale: 'en',
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const filePath = path.join(pagesDir, `${pageSlug}.json`)
    await writeFile(filePath, JSON.stringify(pageConfig, null, 2), 'utf-8')

    // Regenerate the React template file from the block definitions
    try {
      const templateContent = generatePageTemplate(page)
      const templateRelPath = getTemplateFilePath(page.route, activeTheme)
      const templateAbsPath = path.join(projectPath, templateRelPath)
      await mkdir(path.dirname(templateAbsPath), { recursive: true })
      await writeFile(templateAbsPath, templateContent, 'utf-8')
    } catch {
      // Non-fatal: template generation failure shouldn't block JSON save
    }

    results.push({
      page: page.pageName,
      path: `contents/themes/${activeTheme}/pages/${pageSlug}.json`,
    })
  }

  return Response.json({
    ok: true,
    pagesWritten: results.length,
    files: results,
  })
}
