/**
 * The block configs that ship inside the package.
 *
 * BlockService.getForScope keeps a block only when `block.scope` includes the
 * entity being edited, so a config that omits `scope` is filtered out of the
 * picker with nothing to show for it: the block reaches the project, reaches
 * the generated registry, and is still unreachable from the page builder.
 *
 * The scope-filtering logic is covered with mock blocks elsewhere; these read
 * the files that actually ship, which is the half that was wrong.
 */
import { describe, test, expect } from '@jest/globals'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const TEMPLATES = join(__dirname, '../../../templates')

/** Every directory holding block sources that ships to a generated project. */
const BLOCK_ROOTS = [
  join(TEMPLATES, 'blocks'),
  join(TEMPLATES, 'projects/starter/blocks'),
]

function blockDirs(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
}

describe('shipped block configs', () => {
  const cases = BLOCK_ROOTS.flatMap(root =>
    blockDirs(root).map(slug => ({ root, slug, config: join(root, slug, 'config.ts') }))
  )

  test('there are block templates to check', () => {
    expect(cases.length).toBeGreaterThan(0)
  })

  test.each(cases)('$slug declares a scope', ({ config }) => {
    expect(existsSync(config)).toBe(true)
    const source = readFileSync(config, 'utf-8')

    // A scope of [] would satisfy a bare `scope:` check while filtering the
    // block out exactly as omitting it does.
    const scope = source.match(/scope:\s*\[([^\]]*)\]/)
    expect(scope).not.toBeNull()
    expect(scope![1].trim()).not.toBe('')
  })

  test.each(cases)('$slug ships the five files a block needs', ({ root, slug }) => {
    for (const file of ['config.ts', 'schema.ts', 'fields.ts', 'component.tsx', 'index.ts']) {
      expect(existsSync(join(root, slug, file))).toBe(true)
    }
  })

  test.each(cases)('$slug default-exports its component', ({ root, slug }) => {
    // The generated block registry imports these as `import { default as X }`.
    const component = readFileSync(join(root, slug, 'component.tsx'), 'utf-8')
    expect(component).toMatch(/^export default /m)
  })

  test.each(cases)('$slug resolves its imports in a generated project', ({ root, slug }) => {
    // `@/core` is a monorepo alias; a generated project only has `@/`.
    const component = readFileSync(join(root, slug, 'component.tsx'), 'utf-8')
    expect(component).not.toMatch(/from '@\/core/)
  })
})
