/**
 * The root layouts load Geist from files (next/font/local through the `geist` package): importing
 * `next/font/google` makes `next build` reach fonts.googleapis.com, which fails offline (#419).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe.each(['layout.tsx', 'layout.ppr.tsx'])('root %s fonts', (file) => {
  const src = readFileSync(join(__dirname, '../../../src/routes', file), 'utf8')

  it('does not import next/font/google', () => {
    expect(src).not.toMatch(/next\/font\/google/)
  })

  it('keeps the Geist CSS variables on the body', () => {
    expect(src).toMatch(/GeistSans\.variable/)
    expect(src).toMatch(/GeistMono\.variable/)
  })
})

describe('geist CSS variables', () => {
  it.each([
    ['sans', 'GeistSans', '--font-geist-sans'],
    ['mono', 'GeistMono', '--font-geist-mono'],
  ])('%s keeps %s -> %s', (kind, name, variable) => {
    const src = readFileSync(join(__dirname, '../../../node_modules/geist/dist', `${kind}.js`), 'utf8')
    expect(src).toContain(`export const ${name}`)
    expect(src).toContain(`variable: "${variable}"`)
  })
})
