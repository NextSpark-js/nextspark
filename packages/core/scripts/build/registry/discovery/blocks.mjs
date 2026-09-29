/**
 * Block Discovery
 *
 * Discovers page builder blocks from themes
 *
 * @module core/scripts/build/registry/discovery/blocks
 */

import { readdir, stat, readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { log, verbose } from '../../../utils/index.mjs'
import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'

/**
 * How a block's schema.ts exports `schema`, read from its syntax tree (comments, strings and
 * types don't count). The generated BLOCK_SCHEMAS map imports `schema` by name and the
 * validation route calls `.parse()` on it, so only a zod schema bound by `const` qualifies:
 *
 * - `export const schema = ...`
 * - `export { schema }` or `export { local as schema }` of a `const` declared in the file
 *
 * Anything else is reported with the reason, and the block gets no map entry: `let`/`var`
 * (reassignable), `function`/`class` (not a schema), `declare` or type-only exports (no
 * runtime value), a destructured binding, an imported binding or `export ... from`
 * (declared in another module, so this file doesn't show it is a const).
 *
 * @param {string} source - schema.ts content
 * @param {string} fileName - for the parser (extension picks TS/TSX)
 * @param {object} ts - the TypeScript compiler API (loadTypeScriptFor)
 * @returns {{ exportsSchema: true } | { exportsSchema: false, reason: string }}
 */
export function readSchemaExport(source, fileName, ts) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.getScriptKindFromFileName(fileName))
  const K = ts.SyntaxKind
  const hasModifier = (node, kind) => Boolean(node.modifiers?.some(modifier => modifier.kind === kind))
  const isConst = statement => (statement.declarationList.flags & ts.NodeFlags.Const) !== 0 && !(statement.declarationList.flags & (ts.NodeFlags.Let | ts.NodeFlags.Using))
  const kindOf = statement => (statement.declarationList.flags & ts.NodeFlags.Let ? 'let' : isConst(statement) ? 'const' : 'var')

  // Top-level `const` bindings, by name (for `export { local as schema }`), with how each is declared.
  const locals = new Map()
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement) && !hasModifier(statement, K.DeclareKeyword)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) locals.set(declaration.name.text, kindOf(statement))
      }
    } else if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
      locals.set(statement.name.text, ts.isFunctionDeclaration(statement) ? 'function' : 'class')
    } else if (ts.isImportDeclaration(statement) && statement.importClause && !statement.importClause.isTypeOnly) {
      const { name, namedBindings } = statement.importClause
      if (name) locals.set(name.text, 'import')
      if (namedBindings && ts.isNamespaceImport(namedBindings)) locals.set(namedBindings.name.text, 'import')
      for (const element of namedBindings && ts.isNamedImports(namedBindings) ? namedBindings.elements : []) {
        if (!element.isTypeOnly) locals.set(element.name.text, 'import')
      }
    }
  }

  const rejected = reason => ({ exportsSchema: false, reason })
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement) && hasModifier(statement, K.ExportKeyword)) {
      for (const declaration of statement.declarationList.declarations) {
        const names = ts.isIdentifier(declaration.name)
          ? [declaration.name.text]
          : declaration.name.elements?.map(element => element.name?.getText(sourceFile)) ?? []
        if (!names.includes('schema')) continue
        if (hasModifier(statement, K.DeclareKeyword)) return rejected('`schema` is declared with `declare`, so it has no runtime value')
        if (!ts.isIdentifier(declaration.name)) return rejected('`schema` is exported through a destructuring pattern; write `export const schema = ...`')
        if (!isConst(statement)) return rejected(`\`schema\` is declared with \`${kindOf(statement)}\`; write \`export const schema = ...\``)
        return { exportsSchema: true }
      }
    }
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && hasModifier(statement, K.ExportKeyword) && statement.name?.text === 'schema') {
      return rejected(`\`schema\` is a ${ts.isFunctionDeclaration(statement) ? 'function' : 'class'}, not a zod schema; write \`export const schema = ...\``)
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        if (element.name.text !== 'schema') continue
        if (statement.isTypeOnly || element.isTypeOnly) continue
        if (statement.moduleSpecifier) return rejected('`schema` is re-exported from another module; declare it with `export const schema = ...` in schema.ts')
        const local = (element.propertyName ?? element.name).text
        const kind = locals.get(local)
        if (kind === 'const') return { exportsSchema: true }
        if (kind === 'import') return rejected(`\`schema\` re-exports the imported \`${local}\`; declare it with \`export const schema = ...\` in schema.ts`)
        if (kind) return rejected(`\`schema\` exports \`${local}\`, declared with \`${kind}\`; only a \`const\` zod schema is validated`)
        return rejected(`\`schema\` exports \`${local}\`, which is not a runtime binding of schema.ts`)
      }
    }
  }
  return rejected('schema.ts does not export `schema`')
}

/**
 * Discover all blocks in the project root.
 * @param {object} config - Optional configuration object (defaults to DEFAULT_CONFIG)
 * @returns {Promise<Array>} Array of discovered blocks
 */
export async function discoverBlocks(config = DEFAULT_CONFIG) {
  log('Discovering blocks...', 'info')
  const blocks = []

  const themeName = config.projectName
  const blocksDir = join(config.projectSourceDir, 'blocks')

  // Check if blocks directory exists
  try {
    await stat(blocksDir)
  } catch (error) {
    verbose(`No blocks directory found for theme "${themeName}"`)
    return blocks
  }

  try {
    const blockDirs = await readdir(blocksDir, { withFileTypes: true })

    for (const dir of blockDirs) {
      if (!dir.isDirectory()) continue

      const blockSlug = dir.name
      const blockPath = join(blocksDir, blockSlug)

      // Check for required files
      const configPath = join(blockPath, 'config.ts')
      const schemaPath = join(blockPath, 'schema.ts')
      const fieldsPath = join(blockPath, 'fields.ts')
      const componentPath = join(blockPath, 'component.tsx')
      const examplesPath = join(blockPath, 'examples.ts')

      const hasConfig = existsSync(configPath)
      const hasSchema = existsSync(schemaPath)
      const hasFields = existsSync(fieldsPath)
      const hasComponent = existsSync(componentPath)
      const hasExamples = existsSync(examplesPath)

      if (!hasConfig || !hasSchema || !hasFields || !hasComponent) {
        log(`WARNING: Block "${blockSlug}" missing required files (config/schema/fields/component)`, 'warning')
        continue
      }

      // Read config file to extract metadata
      try {
        const configContent = await readFile(configPath, 'utf-8')
        // The generated BLOCK_SCHEMAS map imports `schema` by name, so only a block whose
        // schema.ts exports it gets an entry (block-registry.mjs, generateBlockSchemas).
        const schemaExport = readSchemaExport(
          await readFile(schemaPath, 'utf-8'),
          schemaPath,
          await loadTypeScriptFor(config.projectRoot ?? process.cwd())
        )
        const exportsSchema = schemaExport.exportsSchema
        if (!exportsSchema) {
          log(`WARNING: Block "${blockSlug}": ${schemaExport.reason}. /api/v1/blocks/validate cannot validate this block`, 'warning')
        }

        // Extract metadata using regex (simple parsing)
        const slugMatch = configContent.match(/slug:\s*['"]([^'"]+)['"]/)
        const nameMatch = configContent.match(/name:\s*['"]([^'"]+)['"]/)
        const descMatch = configContent.match(/description:\s*['"]([^'"]+)['"]/)
        const categoryMatch = configContent.match(/category:\s*['"]([^'"]+)['"]/)
        const iconMatch = configContent.match(/icon:\s*['"]([^'"]+)['"]/)
        const scopeMatch = configContent.match(/scope:\s*\[([^\]]+)\]/)
        const allowInPatternsMatch = configContent.match(/allowInPatterns:\s*(true|false)/)

        const extractedSlug = slugMatch ? slugMatch[1] : blockSlug

        if (extractedSlug !== blockSlug) {
          log(`WARNING: Block folder "${blockSlug}" has mismatched slug "${extractedSlug}" in config`, 'warning')
        }

        // Parse scope array if present
        let scope = undefined
        if (scopeMatch) {
          const scopeString = scopeMatch[1]
          scope = scopeString
            .split(',')
            .map(s => s.trim().replace(/['"]/g, ''))
            .filter(s => s.length > 0)
        }

        // Parse allowInPatterns (default: undefined, which means true)
        let allowInPatterns = undefined
        if (allowInPatternsMatch) {
          allowInPatterns = allowInPatternsMatch[1] === 'true'
        }

        blocks.push({
          slug: extractedSlug,
          name: nameMatch ? nameMatch[1] : blockSlug,
          description: descMatch ? descMatch[1] : '',
          category: categoryMatch ? categoryMatch[1] : 'other',
          icon: iconMatch ? iconMatch[1] : 'Box',
          scope,
          allowInPatterns,
          themeName,
          hasExamples,
          exportsSchema,
          paths: {
            config: `@/blocks/${blockSlug}/config`,
            schema: `@/blocks/${blockSlug}/schema`,
            fields: `@/blocks/${blockSlug}/fields`,
            component: `@/blocks/${blockSlug}/component`,
            examples: `@/blocks/${blockSlug}/examples`,
            thumbnail: existsSync(join(blockPath, 'thumbnail.png'))
              ? `/theme/blocks/${blockSlug}/thumbnail.png`
              : null
          }
        })

        verbose(`Block discovered: ${extractedSlug} (${blocks[blocks.length - 1].name})`)
      } catch (error) {
        log(`ERROR: Failed to parse block "${blockSlug}": ${error.message}`, 'error')
      }
    }

    log(`Found ${blocks.length} blocks in theme "${themeName}"`, 'success')
  } catch (error) {
    log(`Error discovering blocks: ${error.message}`, 'error')
  }

  return blocks
}
