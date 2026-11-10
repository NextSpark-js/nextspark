/**
 * #413: the dates and numbers of the project templates and features follow the active locale too. The texts of the
 * templates are English by design, so only the findings about a date or number formatted with no locale, or with a
 * fixed one, are read.
 */
import path from 'node:path'
import { fixedTexts, parseSource, walkSource } from './fixed-text-scanner'

const TEMPLATES = path.join(__dirname, '../../../templates')
const files = [...walkSource(path.join(TEMPLATES, 'projects')), ...walkSource(path.join(TEMPLATES, 'features'))].map(file => path.relative(TEMPLATES, file))

const localeFindings = (file: string) => fixedTexts(parseSource(path.join(TEMPLATES, file))).filter(line => /: (no|fixed) locale/.test(line))

describe('dates and numbers in the templates', () => {
  test('the scan reads the templates', () => {
    expect(files).toEqual(expect.arrayContaining(['projects/crm/lib/crm-utils.ts', 'projects/blog/components/public/PostCard.tsx', 'features/blog/entities/posts/components/post-header.tsx']))
  })

  test.each(files)('%s formats with the active locale', file => {
    expect(localeFindings(file)).toEqual([])
  })
})
