/**
 * The Amplitude plugin reads core's cookie consent (#272): no initialisation before `analytics` is granted,
 * initialisation on the grant, opt-out on revoke. With consent off in app.config it behaves as before.
 */
import { act, render } from '@testing-library/react'
import { AmplitudeProvider } from '../../../../../plugins/amplitude/providers/AmplitudeProvider'
import { AmplitudeCore } from '../../../../../plugins/amplitude/lib/amplitude-core'
import { useConsent } from '@nextsparkjs/core/lib/consent'
import { resolveConsentConfig } from '@nextsparkjs/core/lib/consent/cookie'

jest.mock('../../../../../plugins/amplitude/lib/amplitude-core', () => ({ AmplitudeCore: { init: jest.fn(), setOptOut: jest.fn() } }))
jest.mock('../../../../../plugins/amplitude/plugin.config', () => ({ amplitudePlugin: {} }))

const mockCore = AmplitudeCore as unknown as { init: jest.Mock; setOptOut: jest.Mock }
const mockConfigs = { on: resolveConsentConfig({ enabled: true }), off: resolveConsentConfig({ enabled: false }) }
let mockMode: 'on' | 'off' = 'on'
jest.mock('@nextsparkjs/core/lib/config/public-config-client', () => ({
  get CONSENT_CONFIG() {
    return mockConfigs[mockMode]
  },
}))

const apiKey = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
let consent: ReturnType<typeof useConsent>
function Probe() {
  consent = useConsent()
  return null
}
const mount = () => render(<AmplitudeProvider overrideConfig={{ apiKey } as never}><Probe /></AmplitudeProvider>)
const flush = () => act(async () => { await Promise.resolve() })

beforeEach(() => {
  document.cookie.split(';').forEach((c) => (document.cookie = `${c.split('=')[0].trim()}=; Max-Age=0; Path=/`))
  mockCore.init.mockReset().mockResolvedValue(undefined)
  mockCore.setOptOut.mockReset()
  mockMode = 'on'
  jest.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('AmplitudeProvider and core consent', () => {
  it('does not initialise before the visitor chooses', async () => {
    mount()
    await flush()
    expect(mockCore.init).not.toHaveBeenCalled()
  })

  it('does not initialise after Reject all, or when only marketing was granted', async () => {
    mount()
    act(() => consent.reject())
    await flush()
    act(() => consent.update({ marketing: true }))
    await flush()
    expect(mockCore.init).not.toHaveBeenCalled()
  })

  it('initialises once analytics is granted', async () => {
    mount()
    act(() => consent.update({ analytics: true }))
    await flush()
    expect(mockCore.init).toHaveBeenCalledTimes(1)
    expect(mockCore.init).toHaveBeenCalledWith(apiKey, expect.objectContaining({ apiKey }))
    expect(mockCore.setOptOut).toHaveBeenLastCalledWith(false)
  })

  it('initialises at once for a returning visitor whose cookie grants analytics', async () => {
    const first = mount()
    act(() => consent.accept())
    await flush()
    first.unmount()
    mockCore.init.mockClear()
    mount()
    await flush()
    expect(mockCore.init).toHaveBeenCalledTimes(1)
  })

  it('opts out when analytics is revoked and back in when it is granted again, without a second init', async () => {
    mount()
    act(() => consent.accept())
    await flush()
    act(() => consent.reject())
    await flush()
    expect(mockCore.setOptOut).toHaveBeenLastCalledWith(true)
    act(() => consent.accept())
    await flush()
    expect(mockCore.setOptOut).toHaveBeenLastCalledWith(false)
    expect(mockCore.init).toHaveBeenCalledTimes(1)
  })

  it('with consent off in app.config initialises on mount, as before', async () => {
    mockMode = 'off'
    mount()
    await flush()
    expect(mockCore.init).toHaveBeenCalledTimes(1)
    expect(mockCore.setOptOut).toHaveBeenLastCalledWith(false)
  })
})
