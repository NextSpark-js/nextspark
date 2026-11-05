/**
 * #390: a server component of a (public) page asks for the locale the (public) layout provides.
 */
const getTranslations = jest.fn()
let inDefault = false

jest.mock('next-intl/server', () => ({ getTranslations: (...args: unknown[]) => getTranslations(...args) }))
jest.mock('@nextsparkjs/registries/request-locale', () => ({ get PUBLIC_IN_DEFAULT_LOCALE() { return inDefault } }))
jest.mock('../../../../src/lib/config', () => ({ I18N_CONFIG: { defaultLocale: 'en' } }))

import { getPublicTranslations } from '../../../../src/lib/i18n/public-translations'

beforeEach(() => getTranslations.mockClear())

describe('getPublicTranslations', () => {
  it('asks for the default locale while the public group keeps it', () => {
    inDefault = true
    getPublicTranslations('home')
    expect(getTranslations).toHaveBeenCalledWith({ locale: 'en', namespace: 'home' })
  })

  it("follows the request's locale otherwise", () => {
    inDefault = false
    getPublicTranslations('home')
    expect(getTranslations).toHaveBeenCalledWith('home')
  })
})
