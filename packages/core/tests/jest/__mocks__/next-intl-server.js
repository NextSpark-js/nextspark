/**
 * Jest mock for `next-intl/server`'s `getTranslations`.
 *
 * Loads the corresponding `messages/<locale>/<root>.json` file directly and
 * resolves keys inside `namespace` (which can be dotted, e.g. `email.verifyEmail`).
 * Supports ICU-style `{var}` placeholders in values — replaced naively, no
 * pluralization. Sufficient for email template snapshot tests.
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

function format(template, params) {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] === undefined ? `{${key}}` : String(params[key]),
  )
}

async function getTranslations(opts) {
  const locale = opts?.locale || 'en'
  const namespace = opts?.namespace || ''
  const ns = loadNamespace(locale, namespace)

  return function t(key, params) {
    const value = ns[key]
    if (value === undefined) {
      throw new Error(`next-intl mock: missing key "${key}" in namespace "${namespace}"`)
    }
    return format(value, params)
  }
}

module.exports = {
  getTranslations,
  __esModule: true,
}
