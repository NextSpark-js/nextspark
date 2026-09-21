/** @jest-environment jsdom */
import { afterEach, describe, expect, jest, test } from '@jest/globals'
import { act, render, screen, waitFor } from '@testing-library/react'
import { useAuthReadiness } from '@/core/hooks/useAuthReadiness'

function Probe() {
  const readiness = useAuthReadiness()
  return <pre data-testid="state">{JSON.stringify(readiness)}</pre>
}

const capabilities = { invitationPasswordSignup: true, passwordRecovery: false }

const originalFetch = global.fetch
const originalBasePath = process.env.__NEXT_ROUTER_BASEPATH

afterEach(() => {
  global.fetch = originalFetch
  if (originalBasePath === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
  else process.env.__NEXT_ROUTER_BASEPATH = originalBasePath
})

describe('useAuthReadiness', () => {
  test('loads safe runtime methods from the basePath-aware endpoint', async () => {
    process.env.__NEXT_ROUTER_BASEPATH = '/base'
    let resolveFetch!: (response: Response) => void
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve })) as typeof fetch

    render(<Probe />)
    expect(screen.getByTestId('state')).toHaveTextContent('"state":"loading"')

    await act(async () => {
      resolveFetch(new Response(
        JSON.stringify({ status: 'ready', availableMethods: ['google'], capabilities }),
        { status: 200 },
      ))
    })

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('"state":"ready"'))
    expect(screen.getByTestId('state')).toHaveTextContent('"availableMethods":["google"]')
    expect(screen.getByTestId('state')).toHaveTextContent(
      '"capabilities":{"invitationPasswordSignup":true,"passwordRecovery":false}',
    )
    expect(global.fetch).toHaveBeenCalledWith('/base/api/auth/readiness', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
  })

  test('reports unavailable when the server has no usable method', async () => {
    global.fetch = jest.fn(async () => new Response(
      JSON.stringify({ status: 'unavailable', availableMethods: [], capabilities }),
      { status: 200 },
    )) as typeof fetch

    render(<Probe />)

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('"state":"unavailable"'))
    expect(screen.getByTestId('state')).toHaveTextContent('"availableMethods":[]')
  })

  test('fails closed on network or malformed response errors', async () => {
    global.fetch = jest.fn(async () => new Response(
      JSON.stringify({ status: 'ready', availableMethods: ['not-real'] }),
      { status: 200 },
    )) as typeof fetch

    render(<Probe />)

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('"state":"error"'))
    expect(screen.getByTestId('state')).toHaveTextContent('"availableMethods":[]')
  })

  test.each([
    ['missing', undefined],
    ['non-boolean', { invitationPasswordSignup: 'true', passwordRecovery: false }],
    ['partial', { invitationPasswordSignup: true }],
  ])('fails closed when capabilities are %s', async (_label, badCapabilities) => {
    global.fetch = jest.fn(async () => new Response(
      JSON.stringify({ status: 'ready', availableMethods: ['email-otp'], capabilities: badCapabilities }),
      { status: 200 },
    )) as typeof fetch

    render(<Probe />)

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('"state":"error"'))
    expect(screen.getByTestId('state')).toHaveTextContent(
      '"capabilities":{"invitationPasswordSignup":false,"passwordRecovery":false}',
    )
  })

  test('fails closed with no capabilities when the readiness route is missing', async () => {
    global.fetch = jest.fn(async () => new Response('Not found', { status: 404 })) as typeof fetch

    render(<Probe />)

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('"state":"error"'))
    expect(screen.getByTestId('state')).toHaveTextContent('"invitationPasswordSignup":false')
  })
})
