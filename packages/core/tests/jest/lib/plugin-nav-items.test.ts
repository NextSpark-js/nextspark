/**
 * Plugin navigation (#203, stage 7a): the layouts list the navigation of the plugins in the server registry
 * ('server') and in the client registry ('web'), once each.
 */

jest.mock('@nextsparkjs/registries/plugin-registry', () => ({
  getPluginNavItems: (area: string) => (area === 'devtools' ? [{ href: '/devtools/plugins/ai', label: 'AI' }, { href: '/devtools/plugins/both', label: 'Both' }] : []),
}))
jest.mock('@nextsparkjs/registries/plugin-registry.client', () => ({
  getPluginNavItems: (area: string) => (area === 'devtools' ? [{ href: '/devtools/plugins/both', label: 'Both' }, { href: '/devtools/plugins/walkme', label: 'WalkMe' }] : [{ href: '/superadmin/plugins/amplitude', label: 'Amplitude' }]),
}))

import { getAllPluginNavItems } from '@/core/lib/plugins/nav-items'

describe('getAllPluginNavItems', () => {
  it('merges server and web plugins and lists a plugin declared in both once', () => {
    expect(getAllPluginNavItems('devtools').map((item) => item.label)).toEqual(['AI', 'Both', 'WalkMe'])
  })

  it('finds the navigation of a web-only plugin that the server registry does not hold', () => {
    expect(getAllPluginNavItems('superadmin').map((item) => item.label)).toEqual(['Amplitude'])
  })
})
