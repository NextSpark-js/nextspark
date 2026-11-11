/**
 * #427: a client component whose namespace its area does not carry renders the key, and AreaMessagesCheck says which
 * namespace and where to add it, once per area and namespace. Rendered on the server, as `next build` prerenders the
 * static (auth) and (public) pages and as development renders every page.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React, { createElement as h } from 'react'
import { renderToString } from 'react-dom/server'
import { IntlProvider, useTranslations } from 'use-intl/react'
import { AreaMessagesCheck } from '../../src/providers/area-messages-check'

// tsx compiles core's JSX with the classic runtime (the tsconfig keeps JSX for Next), which reads a global React
Object.assign(globalThis, { React })

function Texts({ namespace, keys }: { namespace: string; keys: string[] }) {
  const t = useTranslations(namespace)
  return h('p', null, keys.map((key) => t(key)).join('|'))
}

function render(area: 'auth' | 'public', messages: Record<string, unknown>, namespace: string, keys: string[]) {
  const warnings: string[] = []
  const { warn, error } = console
  console.warn = (message: string) => void warnings.push(message)
  console.error = () => {} // next-intl's own MISSING_MESSAGE report
  try {
    const html = renderToString(
      h(IntlProvider, { locale: 'es', messages, children: h(AreaMessagesCheck, { area, children: h(Texts, { namespace, keys }) }) }),
    )
    return { html, warnings }
  } finally {
    Object.assign(console, { warn, error })
  }
}

test('a namespace the area lacks renders its keys and is named once, with the config entry to add', () => {
  const { html, warnings } = render('auth', { auth: { title: 'Entrar' } }, 'signInExtras', ['heading', 'help'])
  assert.match(html, /signInExtras\.heading\|signInExtras\.help/)
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /"signInExtras\.heading" renders as its key in the auth area/)
  assert.match(warnings[0], /no "signInExtras" namespace/)
  assert.match(warnings[0], /i18n\.clientNamespaces\.auth/)
})

test('a namespace the area carries renders its texts and warns nothing', () => {
  const { html, warnings } = render('public', { landing: { hero: 'Hola' } }, 'landing', ['hero'])
  assert.match(html, /Hola/)
  assert.deepEqual(warnings, [])
})

test('a key missing inside a namespace the area carries is not reported as a missing namespace', () => {
  const { html, warnings } = render('public', { landingKeys: { hero: 'Hola' } }, 'landingKeys', ['cta'])
  assert.match(html, /landingKeys\.cta/)
  assert.deepEqual(warnings, [])
})
