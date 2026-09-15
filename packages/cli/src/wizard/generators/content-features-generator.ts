/**
 * Content Features Generator
 *
 * Copies optional entities and blocks based on content feature selections:
 * - Pages: Copies pages entity + hero block
 * - Blog: Copies posts entity + post-content block
 * - Neither: No entities or blocks are copied
 */

import fs from 'fs-extra'
import path from 'path'
import type { WizardConfig } from '../types.js'
import { getTemplatesDir } from './templates-dir.js'

/**
 * Get the features directory path
 */
function getFeaturesDir(templatesDir: string): string {
  return path.join(templatesDir, 'features')
}

/**
 * Get the target theme directory in the user's project
 */
function getTargetThemeDir(projectSlug: string): string {
  return path.resolve(process.cwd(), 'contents', 'themes', projectSlug)
}

/**
 * Copy pages feature (pages entity + hero block)
 */
async function copyPagesFeature(config: WizardConfig, templatesDir: string): Promise<void> {
  const featuresDir = getFeaturesDir(templatesDir)
  const targetThemeDir = getTargetThemeDir(config.projectSlug)

  // Copy pages entity
  const sourcePagesEntity = path.join(featuresDir, 'pages', 'entities', 'pages')
  const targetEntitiesDir = path.join(targetThemeDir, 'entities', 'pages')

  if (await fs.pathExists(sourcePagesEntity)) {
    await fs.copy(sourcePagesEntity, targetEntitiesDir)
  } else {
    console.warn(`Warning: Pages entity not found at: ${sourcePagesEntity}`)
  }

  // Copy hero block
  const sourceHeroBlock = path.join(featuresDir, 'pages', 'blocks', 'hero')
  const targetHeroBlock = path.join(targetThemeDir, 'blocks', 'hero')

  if (await fs.pathExists(sourceHeroBlock)) {
    await fs.copy(sourceHeroBlock, targetHeroBlock)
  } else {
    console.warn(`Warning: Hero block not found at: ${sourceHeroBlock}`)
  }
}

/**
 * Copy blog feature (posts entity + post-content block)
 */
async function copyBlogFeature(config: WizardConfig, templatesDir: string): Promise<void> {
  const featuresDir = getFeaturesDir(templatesDir)
  const targetThemeDir = getTargetThemeDir(config.projectSlug)

  // Copy posts entity
  const sourcePostsEntity = path.join(featuresDir, 'blog', 'entities', 'posts')
  const targetPostsEntity = path.join(targetThemeDir, 'entities', 'posts')

  if (await fs.pathExists(sourcePostsEntity)) {
    await fs.copy(sourcePostsEntity, targetPostsEntity)
  } else {
    console.warn(`Warning: Posts entity not found at: ${sourcePostsEntity}`)
  }

  // Copy post-content block
  const sourcePostContentBlock = path.join(featuresDir, 'blog', 'blocks', 'post-content')
  const targetPostContentBlock = path.join(targetThemeDir, 'blocks', 'post-content')

  if (await fs.pathExists(sourcePostContentBlock)) {
    await fs.copy(sourcePostContentBlock, targetPostContentBlock)
  } else {
    console.warn(`Warning: Post-content block not found at: ${sourcePostContentBlock}`)
  }
}

/**
 * Copy content features based on wizard configuration
 *
 * Combinations:
 * - Neither: No entities or blocks copied
 * - Pages only: pages entity + hero block copied
 * - Blog only: posts entity + post-content block copied
 * - Both: pages entity + hero block + posts entity + post-content block copied
 *
 * @param templatesDir - The core templates to copy from; see copyStarterTheme
 *   for why the generator passes it.
 */
export async function copyContentFeatures(config: WizardConfig, templatesDir?: string): Promise<void> {
  // Skip if no content features are enabled
  if (!config.contentFeatures.pages && !config.contentFeatures.blog) {
    return
  }

  const sourceTemplatesDir = templatesDir ?? getTemplatesDir()

  // Copy pages feature if enabled
  if (config.contentFeatures.pages) {
    await copyPagesFeature(config, sourceTemplatesDir)
  }

  // Copy blog feature if enabled
  if (config.contentFeatures.blog) {
    await copyBlogFeature(config, sourceTemplatesDir)
  }
}
