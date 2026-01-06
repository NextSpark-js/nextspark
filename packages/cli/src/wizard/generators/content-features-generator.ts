/**
 * Content Features Generator
 *
 * Copies optional entities and blocks based on content feature selections:
 * - Pages: Copies pages entity (hero block already in starter)
 * - Blog: Copies posts entity + post-content block
 */

import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import type { WizardConfig } from '../types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Get the templates directory path from @nextsparkjs/core
 */
function getTemplatesDir(): string {
  // In development (monorepo), templates are in core package
  // In production, they come from installed @nextsparkjs/core
  try {
    // Try to resolve from @nextsparkjs/core package
    const corePkgPath = require.resolve('@nextsparkjs/core/package.json');
    return path.join(path.dirname(corePkgPath), 'templates');
  } catch {
    // Fallback for monorepo development
    const possiblePaths = [
      path.resolve(__dirname, '../../../../../core/templates'),
      path.resolve(__dirname, '../../../../core/templates'),
      path.resolve(process.cwd(), 'node_modules/@nextsparkjs/core/templates'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    throw new Error('Could not find @nextsparkjs/core templates directory');
  }
}

/**
 * Get the features directory path
 */
function getFeaturesDir(): string {
  return path.join(getTemplatesDir(), 'features')
}

/**
 * Get the target theme directory in the user's project
 */
function getTargetThemeDir(projectSlug: string): string {
  return path.resolve(process.cwd(), 'contents', 'themes', projectSlug)
}

/**
 * Copy pages feature (entity only, hero block already in starter)
 */
async function copyPagesFeature(config: WizardConfig): Promise<void> {
  const featuresDir = getFeaturesDir()
  const targetThemeDir = getTargetThemeDir(config.projectSlug)

  const sourcePagesEntity = path.join(featuresDir, 'pages', 'entities', 'pages')
  const targetEntitiesDir = path.join(targetThemeDir, 'entities', 'pages')

  // Check if source exists
  if (!await fs.pathExists(sourcePagesEntity)) {
    console.warn(`Warning: Pages entity not found at: ${sourcePagesEntity}`)
    return
  }

  // Copy pages entity
  await fs.copy(sourcePagesEntity, targetEntitiesDir)
}

/**
 * Copy blog feature (posts entity + post-content block)
 */
async function copyBlogFeature(config: WizardConfig): Promise<void> {
  const featuresDir = getFeaturesDir()
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
 * - Neither: No additional entities/blocks copied
 * - Pages only: pages entity copied (hero already in starter)
 * - Blog only: posts entity + post-content block copied
 * - Both: pages entity + posts entity + post-content block copied
 */
export async function copyContentFeatures(config: WizardConfig): Promise<void> {
  // Skip if no content features are enabled
  if (!config.contentFeatures.pages && !config.contentFeatures.blog) {
    return
  }

  // Copy pages feature if enabled
  if (config.contentFeatures.pages) {
    await copyPagesFeature(config)
  }

  // Copy blog feature if enabled
  if (config.contentFeatures.blog) {
    await copyBlogFeature(config)
  }
}
