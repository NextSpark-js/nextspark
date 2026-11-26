/**
 * The root layouts load Geist from files, with no request to a font service (#419) and no second stylesheet (#560).
 *
 * `next/font` (the `geist` package is `next/font/local`) writes its `@font-face` rules into a CSS file of its own,
 * which the HTML links as a second render-blocking stylesheet after the project's. So the layouts do not import it:
 * the rules are in styles/fonts.css, which styles/utilities.css imports (one stylesheet), and the layouts do not
 * preload the two files (#575): no project template uses the variables, so a preload costs ~140 KB on every first visit
 * for a font nothing applies, and the browser downloads a face on its own when a page's CSS does use it.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const CORE = join(__dirname, '../../..')
const read = (...parts: string[]) => readFileSync(join(CORE, ...parts), 'utf8')

describe.each(['layout.tsx', 'layout.ppr.tsx'])('root %s fonts', (file) => {
  const src = read('src/routes', file)

  it('does not import next/font or the geist package (a font module is a stylesheet of its own)', () => {
    expect(src).not.toMatch(/from\s+['"]next\/font/)
    expect(src).not.toMatch(/from\s+['"]geist/)
    expect(src).not.toMatch(/\.css['"]/)
  })

  it('keeps the Geist CSS variables on the body, through the class of styles/fonts.css', () => {
    expect(src).toMatch(/<body\s+className="geist-fonts /)
  })

  it('does not preload the Geist files, a font no template applies (#575)', () => {
    expect(src).not.toMatch(/rel="preload"[^>]*as="font"/)
    expect(src).not.toMatch(/GEIST_/)
    expect(src).not.toMatch(/geist-font-urls/)
  })
})

describe('styles/fonts.css', () => {
  const css = read('styles/fonts.css')

  it('is part of the stylesheet every project imports (utilities.css), so the build writes it into the main CSS', () => {
    expect(read('styles/utilities.css')).toMatch(/@import "\.\/fonts\.css";/)
  })

  it.each([
    ['GeistSans', 'Geist-Variable.woff2', '--font-geist-sans'],
    ['GeistMono', 'GeistMono-Variable.woff2', '--font-geist-mono'],
  ])('declares %s from %s and the variable %s', (family, file, variable) => {
    expect(css).toContain(`font-family: "${family}";`)
    expect(css).toContain(`url("./fonts/${file}") format("woff2")`)
    expect(existsSync(join(CORE, 'styles/fonts', file))).toBe(true)
    expect(css).toMatch(new RegExp(`\\.geist-fonts \\{[^}]*${variable}:`))
  })

  it('keeps the metric-compatible fallback of the sans face (size-adjust), so the swap does not shift the text', () => {
    expect(css).toMatch(/font-family: "GeistSans Fallback";[^}]*size-adjust: 106\.28%/)
    expect(css).toContain('--font-geist-sans: "GeistSans", "GeistSans Fallback";')
  })

  it('is an export of the package (a project can import it alone) and listed in public-api.json', () => {
    expect(JSON.parse(read('package.json')).exports['./styles/fonts.css']).toBe('./styles/fonts.css')
    expect(read('public-api.json')).toContain('"subpath": "./styles/fonts.css"')
  })

  it('swaps instead of hiding the text while the file loads', () => {
    expect(css.match(/font-display: swap;/g)).toHaveLength(2)
  })
})
