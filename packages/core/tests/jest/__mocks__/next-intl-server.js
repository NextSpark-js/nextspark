/**
 * Jest mock for `next-intl/server`'s `getTranslations`.
 *
 * Loads the corresponding `messages/<locale>/<root>.json` file directly and
 * resolves keys inside `namespace` (which can be dotted, e.g. `email.verifyEmail`).
 * Supports ICU-style `{var}` placeholders, replaced naively, plus the `plural`
 * argument type (`{var, plural, one {...} other {...}}`) resolved through
 * `Intl.PluralRules` — the subset the email templates actually use. Sufficient
 * for email template snapshot tests, not a general ICU MessageFormat parser.
 */

const path = require('path')
const fs = require('fs')

function loadNamespace(locale, namespace) {
  // namespace is dotted: "email.verifyEmail" → root file "email", key path "verifyEmail"
  const [rootFile, ...rest] = namespace.split('.')
  const filePath = path.join(
    __dirname,
    '../../../src/messages',
    locale,
    `${rootFile}.json`,
  )
  const raw = fs.readFileSync(filePath, 'utf8')
  let obj = JSON.parse(raw)
  for (const segment of rest) {
    obj = obj[segment]
    if (!obj) throw new Error(`next-intl mock: missing segment "${segment}" in ${filePath}`)
  }
  return obj
}

/**
 * Resolves every `{varName, plural, category {text} ...}` block in `template`,
 * picking the branch via `Intl.PluralRules` (falling back to an explicit
 * `=<n>` match, then to `other`) and substituting `#` with the value.
 * Parses by brace-depth rather than regex so a category's text may itself
 * contain other `{placeholder}` tokens.
 */
function resolveIcuPlural(template, params, locale) {
  const marker = ', plural,'
  let result = ''
  let i = 0

  while (i < template.length) {
    if (template[i] !== '{') {
      result += template[i]
      i++
      continue
    }

    const commaIndex = template.indexOf(',', i)
    if (commaIndex === -1 || template.slice(commaIndex, commaIndex + marker.length) !== marker) {
      result += template[i]
      i++
      continue
    }

    const varName = template.slice(i + 1, commaIndex).trim()
    let cursor = commaIndex + marker.length
    const categories = {}

    while (cursor < template.length) {
      while (/\s/.test(template[cursor])) cursor++
      if (template[cursor] === '}') {
        cursor++
        break
      }
      const catStart = cursor
      while (template[cursor] !== '{') cursor++
      const catName = template.slice(catStart, cursor).trim()
      cursor++ // skip the category's opening '{'
      let subDepth = 1
      const subStart = cursor
      while (subDepth > 0) {
        if (template[cursor] === '{') subDepth++
        else if (template[cursor] === '}') subDepth--
        if (subDepth > 0) cursor++
      }
      categories[catName] = template.slice(subStart, cursor)
      cursor++ // skip the category's closing '}'
      while (/\s/.test(template[cursor])) cursor++
      if (template[cursor] === '}') {
        cursor++
        break
      }
    }

    const value = params ? params[varName] : undefined
    const numValue = Number(value)
    let category = categories[`=${numValue}`] !== undefined ? `=${numValue}` : undefined
    if (category === undefined) {
      try {
        category = new Intl.PluralRules(locale || 'en').select(numValue)
      } catch {
        category = 'other'
      }
      if (categories[category] === undefined) category = 'other'
    }

    result += (categories[category] ?? '').replace(/#/g, String(numValue))
    i = cursor
  }

  return result
}

function format(template, params, locale) {
  if (!params) return template
  const resolved = template.includes(', plural,')
    ? resolveIcuPlural(template, params, locale)
    : template
  return resolved.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] === undefined ? `{${key}}` : String(params[key]),
  )
}

async function getTranslations(namespaceOrOpts) {
  const locale = typeof namespaceOrOpts === 'string' ? 'en' : namespaceOrOpts?.locale || 'en'
  const namespace = typeof namespaceOrOpts === 'string' ? namespaceOrOpts : namespaceOrOpts?.namespace || ''
  const ns = loadNamespace(locale, namespace)

  return function t(key, params) {
    const value = ns[key]
    if (value === undefined) {
      throw new Error(`next-intl mock: missing key "${key}" in namespace "${namespace}"`)
    }
    return format(value, params, locale)
  }
}

module.exports = {
  getTranslations,
  __esModule: true,
}
