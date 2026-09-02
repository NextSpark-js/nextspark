/**
 * Unit Tests: device fingerprint primitives (issue #75)
 *
 * Covers the two behaviors called out in the acceptance criteria:
 *   - IP /24 truncation (same /24 → same fingerprint; different /24 → different)
 *   - UA patch-version stripping (patch/build churn does NOT change the fingerprint)
 * plus the header-extraction precedence for client IP.
 */

import { describe, test, expect } from '@jest/globals'
import {
  computeDeviceFingerprint,
  extractClientIp,
  normalizeUserAgent,
  ipToNetworkKey,
} from '@/core/lib/auth/security-notifications/device-fingerprint'

const CHROME_120 =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36'

describe('normalizeUserAgent', () => {
  test('strips patch/build version components, keeps major.minor', () => {
    expect(normalizeUserAgent('Chrome/120.0.6099.109')).toBe('chrome/120.0')
  })

  test('leaves two-component versions (e.g. Safari/537.36) untouched', () => {
    expect(normalizeUserAgent('Safari/537.36')).toContain('537.36')
  })

  test('lower-cases and collapses whitespace', () => {
    expect(normalizeUserAgent('  Foo   Bar/1.2.3  ')).toBe('foo bar/1.2')
  })

  test('empty / null UA normalizes to empty string', () => {
    expect(normalizeUserAgent(null)).toBe('')
    expect(normalizeUserAgent(undefined)).toBe('')
    expect(normalizeUserAgent('')).toBe('')
  })
})

describe('ipToNetworkKey', () => {
  test('truncates IPv4 to its /24 network', () => {
    expect(ipToNetworkKey('203.0.113.42')).toBe('203.0.113.0/24')
    expect(ipToNetworkKey('203.0.113.255')).toBe('203.0.113.0/24')
  })

  test('handles IPv4-mapped IPv6', () => {
    expect(ipToNetworkKey('::ffff:203.0.113.42')).toBe('203.0.113.0/24')
  })

  test('buckets IPv6 to a coarse /48-ish key', () => {
    expect(ipToNetworkKey('2001:db8:abcd:1234::1')).toBe('2001:db8:abcd::/48')
  })

  test('passes through unknown / empty', () => {
    expect(ipToNetworkKey('unknown')).toBe('unknown')
    expect(ipToNetworkKey(null)).toBe('')
  })
})

describe('computeDeviceFingerprint', () => {
  test('is a stable 64-char hex sha256', () => {
    const fp = computeDeviceFingerprint(CHROME_120, '203.0.113.42')
    expect(fp).toMatch(/^[0-9a-f]{64}$/)
  })

  test('IP /24 truncation: same /24 → same fingerprint', () => {
    const a = computeDeviceFingerprint(CHROME_120, '203.0.113.42')
    const b = computeDeviceFingerprint(CHROME_120, '203.0.113.200')
    expect(a).toBe(b)
  })

  test('different /24 → different fingerprint', () => {
    const a = computeDeviceFingerprint(CHROME_120, '203.0.113.42')
    const c = computeDeviceFingerprint(CHROME_120, '203.0.114.42')
    expect(a).not.toBe(c)
  })

  test('UA patch-version stripping: patch/build churn → same fingerprint', () => {
    const older = computeDeviceFingerprint(
      'Mozilla/5.0 Chrome/120.0.6099.109 Safari/537.36',
      '203.0.113.42',
    )
    const newer = computeDeviceFingerprint(
      'Mozilla/5.0 Chrome/120.0.6099.999 Safari/537.36',
      '203.0.113.42',
    )
    expect(older).toBe(newer)
  })

  test('a real minor/major UA change → different fingerprint', () => {
    const v120 = computeDeviceFingerprint('Chrome/120.0.6099.109', '203.0.113.42')
    const v121 = computeDeviceFingerprint('Chrome/121.0.1.1', '203.0.113.42')
    expect(v120).not.toBe(v121)
  })

  test('null UA and null IP still produce a stable fingerprint', () => {
    expect(computeDeviceFingerprint(null, null)).toBe(
      computeDeviceFingerprint(null, null),
    )
  })
})

describe('extractClientIp', () => {
  test('prefers cf-connecting-ip above everything', () => {
    const headers = new Headers({
      'cf-connecting-ip': '1.1.1.1',
      'x-forwarded-for': '2.2.2.2, 3.3.3.3',
      'x-real-ip': '4.4.4.4',
    })
    expect(extractClientIp(headers)).toBe('1.1.1.1')
  })

  test('uses the RIGHTMOST x-forwarded-for entry (last trusted proxy)', () => {
    const headers = new Headers({ 'x-forwarded-for': '2.2.2.2, 3.3.3.3' })
    expect(extractClientIp(headers)).toBe('3.3.3.3')
  })

  test('falls back to x-real-ip, then true-client-ip, then "unknown"', () => {
    expect(extractClientIp(new Headers({ 'x-real-ip': '4.4.4.4' }))).toBe('4.4.4.4')
    expect(extractClientIp(new Headers({ 'true-client-ip': '5.5.5.5' }))).toBe('5.5.5.5')
    expect(extractClientIp(new Headers({}))).toBe('unknown')
  })
})
