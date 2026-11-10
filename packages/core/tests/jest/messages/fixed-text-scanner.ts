/**
 * Shared by the namespace tests of the translated areas (#412 superadmin, #414 devtools, and #413 for all of `src`):
 * finds the texts a person reads that are written in the source instead of read from a catalog, finds the catalog
 * keys a source reads, and checks that the messages of a catalog are valid ICU.
 *
 * What the scan reads (a text is "fixed" when it is written in one of these places):
 *  - JSX text, and a literal or a template literal as a JSX child (`{'Text'}`, `` {`Text ${x}`} ``)
 *  - a visible attribute (`title`, `placeholder`, `alt`, `aria-label`, ...) as a literal, `{'...'}` or a template
 *  - a sentence-like literal or template (starts with an uppercase letter) in a ternary branch, a `||`/`??`/`&&`
 *    fallback, a `+` concatenation, `new Error(...)`, a default parameter or a destructuring default
 *  - the first argument of a message call (`toast`, `toast.error|success|info|warning|loading|message`, `setError`,
 *    `confirm`, `alert`)
 *  - a property whose name is a visible one (`label`, `title`, `description`, `message`, `text`, ...) with a text value
 *  - the values of an object literal declared as a `Record<..., string>` (a map of texts)
 *
 * What it does NOT see, without a type checker and a data-flow analysis (a disproportionate effort for a test):
 *  - a text kept in a plain variable or constant and rendered later (`const msg = 'Saved'; ... {msg}`)
 *  - a lowercase-start text outside JSX and visible attributes (it cannot be told from a class list or an identifier)
 *  - a text built by a function call (`['a', 'b'].join(' and ')`) or returned from a helper that is not a message call
 *  - texts in arrays of strings (`['One', 'Two']`)
 * Those need a review, or a rule written for the area (a `Record` type annotation brings a map into the scan).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

export type NotTranslatable = Record<string, string>

/** The hooks that read a text from the catalog and fall back to the English one written in the call (components/ui and shared only). */
const FALLBACK_HELPERS = new Set(['useSectionText', 'useMessageText', 'useCommonText'])

export function walkSource(dir: string, extensions = ['.ts', '.tsx']): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return walkSource(full, extensions)
    return extensions.some(ext => name.endsWith(ext)) && !name.endsWith('.d.ts') ? [full] : []
  })
}

export const parseSource = (file: string) =>
  ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

const VISIBLE_ATTRIBUTES = new Set(['placeholder', 'title', 'alt', 'aria-label', 'aria-description', 'label', 'description', 'helpText', 'allLabel'])
// property names whose text a person reads, in an object literal
const VISIBLE_PROPERTIES = new Set([...VISIBLE_ATTRIBUTES, 'message', 'text', 'heading', 'subtitle', 'tooltip', 'hint'])
const MESSAGE_CALLS = new Set([
  'toast', 'toast.success', 'toast.error', 'toast.info', 'toast.warning', 'toast.loading', 'toast.message',
  'setError', 'confirm', 'alert',
])

const LOCALE_FORMATTER = /(\.toLocale(Date|Time)?String|^Intl\.(DateTimeFormat|NumberFormat|RelativeTimeFormat|ListFormat|PluralRules))$/

// a demo email address is data, not a text
const PURE_EMAIL = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/

/** The text of a literal or a template, with `{}` where a template has a substitution. `head` is what comes before the first one. */
function textOf(node: ts.Node): { text: string; head: string } | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return { text: node.text, head: node.text }
  if (ts.isTemplateExpression(node)) {
    return { text: node.head.text + node.templateSpans.map(span => `{}${span.literal.text}`).join(''), head: node.head.text }
  }
  return null
}

/** `fixedTexts(source, notTranslatable)`: `file:line: text` for each fixed text. `notTranslatable` maps a text that stays as it is to the reason. */
export function fixedTexts(source: ts.SourceFile, notTranslatable: NotTranslatable = {}): string[] {
  const found: string[] = []
  const at = (node: ts.Node, text: string) =>
    found.push(`${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${text.replace(/\s+/g, ' ').trim()}`)
  const letters = (text: string) => /[A-Za-z]{2}/.test(text)
  const stays = (text: string) => text.trim() in notTranslatable || PURE_EMAIL.test(text.trim())
  // starts like the first word of a sentence or label ("Free", "API key missing"); a class list or a variant is lowercase
  const sentence = (text: string) => /^[A-Z]/.test(text.trim()) && letters(text)
  const insideCode = (node: ts.Node) => {
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isJsxElement(p) && ['code', 'pre'].includes(p.openingElement.tagName.getText(source))) return true
    }
    return false
  }
  const isRecordOfStrings = (type: ts.TypeNode | undefined) => !!type && /^Record<[^]*,\s*string>$/.test(type.getText(source).trim())

  // a literal or template in a place where a person reads it. `anyText`: any text with letters; otherwise a sentence.
  const check = (node: ts.Node, anyText: boolean) => {
    const found_ = textOf(node)
    if (!found_ || stays(found_.text)) return
    const reads = anyText ? (ts.isTemplateExpression(node) ? /[A-Za-z]{3}/.test(found_.text) : letters(found_.text)) : sentence(found_.head)
    if (reads && !insideCode(node)) at(node, found_.text)
  }
  // the branches of `a ? b : c`, `a || b`, `a && b` when the value is a text
  const branches = (node: ts.Node): ts.Node[] => {
    const parent = node.parent
    if (ts.isConditionalExpression(parent) && parent.condition !== node) return [node]
    if (ts.isBinaryExpression(parent) && parent.right === node && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(parent.operatorToken.kind)) return [node]
    return []
  }

  const visit = (node: ts.Node) => {
    // the default texts a component passes to the helpers that read the catalog without a provider are checked against the catalog
    // (the key test compares each with the English text), so what is written in their arguments is not a fixed text
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && FALLBACK_HELPERS.has(node.expression.text)) return
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, ' ').trim()
      if (text && letters(text) && !stays(text) && !insideCode(node)) at(node, text)
    } else if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      // {'Text'} and {`Text ${x}`} as a child
      check(node.expression, true)
    } else if (ts.isJsxAttribute(node) && node.initializer && VISIBLE_ATTRIBUTES.has(node.name.getText(source))) {
      const init = node.initializer
      if (ts.isStringLiteral(init)) {
        if (letters(init.text) && !stays(init.text)) at(node, `${node.name.getText(source)}="${init.text}"`)
      } else if (ts.isJsxExpression(init) && init.expression) {
        check(init.expression, true) // title={'...'} and title={`...${x}`}
      }
    } else if (ts.isCallExpression(node) && MESSAGE_CALLS.has(node.expression.getText(source)) && node.arguments[0]) {
      check(node.arguments[0], true)
    } else if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && LOCALE_FORMATTER.test(node.expression.getText(source)) && (!node.arguments?.[0] || node.arguments[0].getText(source) === 'undefined')) {
      // a date or a number formatted with no locale: it follows the browser, not the language of the interface (and the server and the client can disagree)
      at(node, `no locale in ${node.expression.getText(source)}()`)
    } else if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && node.arguments?.[0] && ts.isStringLiteral(node.arguments[0]) && LOCALE_FORMATTER.test(node.expression.getText(source))) {
      // a date or a number formatted for one fixed locale ('es-ES') instead of the active one
      at(node, `fixed locale ${node.arguments[0].getText(source)}`)
    } else if (ts.isNewExpression(node) && node.expression.getText(source) === 'Error' && node.arguments?.[0]) {
      check(node.arguments[0], false)
    } else if (ts.isPropertyAssignment(node) && VISIBLE_PROPERTIES.has(node.name.getText(source))) {
      check(node.initializer, false)
    } else if ((ts.isParameter(node) || ts.isBindingElement(node)) && node.initializer) {
      check(node.initializer, false) // default parameter / destructuring default
    } else if (ts.isVariableDeclaration(node) && isRecordOfStrings(node.type) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      for (const property of node.initializer.properties) if (ts.isPropertyAssignment(property)) check(property.initializer, false)
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      // 'Failed: ' + message
      for (const side of [node.left, node.right]) if (textOf(side) && !ts.isBinaryExpression(side)) check(side, false)
    }
    // ternary branches and fallbacks, whatever contains them
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      for (const branch of branches(node)) check(branch, false)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  // the same text can be reached by two rules
  return [...new Set(found)]
}

// --- the keys a source reads --------------------------------------------------------------------------------------

const TRANSLATION_FACTORIES = ['useTranslations', 'getTranslations', 'getPublicTranslations']

/**
 * The `t('key')` calls of a source, with the namespace of the `useTranslations`/`getTranslations`/`getPublicTranslations` they come
 * from (no argument: the root, so the key is the full path). A key written as a ternary (`t(ok ? 'a' : 'b')`) reads both branches,
 * a template (`t(`status.${x}`)`) its fixed head, and `(await getPublicTranslations('docs'))('title')` is read as well.
 */
export function keysRead(source: ts.SourceFile): { key: string; dynamic: boolean }[] {
  const namespaces: Record<string, string> = {}
  const reads: { key: string; dynamic: boolean }[] = []
  const factoryNamespace = (call: ts.Node): string | undefined => {
    const init = ts.isAwaitExpression(call) ? call.expression : call
    if (ts.isCallExpression(init) && ts.isIdentifier(init.expression) && TRANSLATION_FACTORIES.includes(init.expression.text)) {
      const first = init.arguments[0]
      if (!first) return ''
      if (ts.isStringLiteral(first)) return first.text
    }
    return undefined
  }
  const push = (namespace: string, arg: ts.Node) => {
    const join = (key: string) => (namespace ? `${namespace}.${key}` : key)
    if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) reads.push({ key: join(arg.text), dynamic: false })
    else if (ts.isTemplateExpression(arg)) reads.push({ key: join(arg.head.text), dynamic: true })
    else if (ts.isConditionalExpression(arg)) {
      push(namespace, arg.whenTrue)
      push(namespace, arg.whenFalse)
    } else if (ts.isParenthesizedExpression(arg)) push(namespace, arg.expression)
  }
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const namespace = factoryNamespace(node.initializer)
      if (namespace !== undefined) namespaces[node.name.text] = namespace
    }
    if (ts.isCallExpression(node)) {
      const arg = node.arguments[0]
      const calleeText = node.expression.getText(source)
      const callee = calleeText.replace(/\.(rich|has)$/, '')
      if (callee in namespaces && arg && !/\.has$/.test(calleeText)) push(namespaces[callee], arg)
      // (await getPublicTranslations('docs'))('title')
      else if (arg && ts.isParenthesizedExpression(node.expression)) {
        const namespace = factoryNamespace(node.expression.expression)
        if (namespace !== undefined) push(namespace, arg)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return reads
}

export const lookupKey = (catalogs: Record<string, unknown>, full: string) =>
  full.split('.').reduce<any>((node, key) => (node && typeof node === 'object' ? node[key] : undefined), catalogs)

// --- ICU ----------------------------------------------------------------------------------------------------------

// `intl-messageformat` is what next-intl formats with. It is an ES module and a dependency of `use-intl`, not of core,
// so a child node process loads it (Jest here runs CommonJS) from where `use-intl` resolves it.
const ICU_CHECK = `
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
const { messages, locale, path } = JSON.parse(readFileSync(0, 'utf8'))
const { IntlMessageFormat } = await import(pathToFileURL(path).href)
const errors = {}
for (const [key, text] of Object.entries(messages)) {
  try { new IntlMessageFormat(text, locale) } catch (error) { errors[key] = error.message }
}
process.stdout.write(JSON.stringify(errors))
`

/**
 * The messages that are not valid ICU, or that quote a placeholder: ICU reads `'{path}'` (and `d'{name}`) as
 * literal text, so the person sees the braces.
 */
export function brokenMessages(messages: Record<string, string>, locale: string): string[] {
  const resolved = createRequire(require.resolve('use-intl')).resolve('intl-messageformat')
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', ICU_CHECK], { encoding: 'utf8', input: JSON.stringify({ messages, locale, path: resolved }), maxBuffer: 64 * 1024 * 1024 })
  if (run.status !== 0) throw new Error(`the ICU check did not run: ${run.stderr}`)
  const parseErrors = JSON.parse(run.stdout) as Record<string, string>
  return Object.entries(messages).flatMap(([key, text]) => {
    // an apostrophe before a brace opens a quote: everything up to the next apostrophe reads as literal text (`d'{name}`, `'{path}'`)
    if (/'\{/.test(text)) return [`${key}: an apostrophe before a placeholder reads it as literal text`]
    return key in parseErrors ? [`${key}: ${parseErrors[key]}`] : []
  })
}
