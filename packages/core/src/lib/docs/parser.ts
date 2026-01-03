/**
 * Documentation Parser Utility
 *
 * Parses markdown files with gray-matter frontmatter and converts to HTML
 * using remark. Provides utilities for extracting metadata from file names.
 */

import fs from 'fs'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeShiki from '@shikijs/rehype'
import rehypeStringify from 'rehype-stringify'

// Re-export utility functions
export {
  extractOrderFromFilename,
  cleanFilename,
  slugToTitle
} from './utils'

/**
 * Metadata extracted from frontmatter
 */
export interface DocMetadata {
  title: string
  description?: string
  order?: number
  public?: boolean
}

/**
 * Parsed documentation page
 */
export interface DocPage {
  slug: string
  title: string
  content: string
  metadata: DocMetadata
  path: string
  source: 'core' | 'theme'
}

/**
 * Documentation section (folder)
 */
export interface DocSection {
  title: string
  slug: string
  order: number
  pages: DocPage[]
  children?: DocSection[]
}

/**
 * Parse a markdown file with frontmatter and convert to HTML
 *
 * @param filePath - Absolute path to markdown file
 * @returns Parsed metadata, raw content, and HTML
 */
export async function parseMarkdownFile(filePath: string): Promise<{
  metadata: DocMetadata
  content: string
  html: string
}> {
  const fileContent = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(fileContent)

  const processedContent = await remark()
    .use(remarkGfm) // GitHub Flavored Markdown (tables, strikethrough, etc.)
    .use(remarkRehype, { allowDangerousHtml: true }) // Convert to rehype AST
    .use(rehypeShiki, { theme: 'github-dark' }) // Syntax highlighting
    .use(rehypeStringify, { allowDangerousHtml: true }) // Serialize to HTML
    .process(content)

  return {
    metadata: data as DocMetadata,
    content,
    html: processedContent.toString()
  }
}
