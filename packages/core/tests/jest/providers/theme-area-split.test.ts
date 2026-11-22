/**
 * #546: ThemeArea lives in its own module, imported only by the layouts of the areas with a session, so the root theme
 * provider (loaded by every route) carries none of its code and public pages load no more JavaScript for it.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

const src = path.resolve(__dirname, '../../../src')
const read = (file: string) => readFileSync(path.join(src, file), 'utf8')

describe('ThemeArea is not part of the root theme provider', () => {
  it('the provider module does not define or export it', () => {
    const provider = read('providers/theme-provider.tsx')
    expect(provider).not.toMatch(/export function ThemeArea/)
    expect(provider).not.toMatch(/useLayoutEffect/)
  })

  it.each([
    'components/dashboard/layouts/AuthenticatedDashboardLayout.tsx',
    'routes/_internal/devtools-layout.tsx',
    'routes/_internal/superadmin-layout.tsx',
  ])('%s imports it from its own module', (file) => {
    const code = read(file)
    expect(code).toMatch(/import \{ ThemeArea \} from ["'][^"']*providers\/theme-area["']/)
    expect(code).not.toMatch(/ThemeArea[^;\n]*from ["'][^"']*providers\/theme-provider["']/)
  })
})
