/**
 * #574: the dashboard entity list keeps the server's rows behind its skeleton until the team is ready, and relies on
 * the team never being ready on the server or in the hydration render, where the HTML and the first client render must
 * agree (rows' date cells depend on the time zone of whoever renders). TeamProvider is ready only once useAuth's session
 * is no longer pending, and useAuth reads Better Auth's `useSession`, whose React store answers the server render and the
 * hydration render with its server snapshot: the store's initial, pending value, whatever the browser's store holds by
 * then. This pins that contract with core's real auth client, so a Better Auth upgrade that changes it fails here.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { authClient } from '../../src/lib/auth-client'

type SessionState = { data: unknown; isPending: boolean }
type Atom = { get(): SessionState; set(value: SessionState): void }

function sessionAtom(): Atom {
  const atoms = (authClient as unknown as { $store: { atoms: Record<string, Atom> } }).$store.atoms
  const atom = atoms.session
  assert.ok(atom, 'the auth client exposes its session store')
  return atom
}

function Probe() {
  const session = authClient.useSession() as unknown as SessionState
  return React.createElement('span', null, `${session.isPending}:${session.data === null ? 'none' : 'user'}`)
}

test('the session is pending in the server snapshot, even when the store already holds a session', () => {
  assert.equal(renderToString(React.createElement(Probe)), '<span>true:none</span>')

  const atom = sessionAtom()
  atom.set({ ...atom.get(), data: { user: { id: 'u1' }, session: { id: 's1' } }, isPending: false })
  assert.equal(atom.get().isPending, false)
  // The store says signed in; the render that the server and the hydration use still says pending
  assert.equal(renderToString(React.createElement(Probe)), '<span>true:none</span>')
})
