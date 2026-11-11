import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PRESET, getDefaultConfig, getPreset } from '../src/wizard/presets.js'
import { featureChoices } from '../src/wizard/prompts/features-config.js'
import { nextsparkConfigSource } from '../src/wizard/generators/index.js'

test('the default preset and default config have no billing', () => {
  for (const config of [getPreset(DEFAULT_PRESET), getDefaultConfig()]) {
    assert.equal(config.billingModel, 'free')
    assert.equal(config.features.billing, false)
  }
})

test('paid billing stays available as an explicit preset', () => {
  assert.equal(getPreset('crm').billingModel, 'paid')
  assert.equal(getPreset('crm').features.billing, true)
})

test('the billing feature checkbox follows the chosen billing model', () => {
  const billing = (model: 'free' | 'paid' | 'freemium') =>
    featureChoices(model).find((o) => o.value === 'billing')?.checked
  assert.equal(billing('free'), false)
  assert.equal(billing('paid'), true)
  assert.equal(billing('freemium'), true)
})

test('billing left unchecked writes features.billing: false to nextspark.config.ts, and checked writes no flag (#425)', () => {
  const off = nextsparkConfigSource({ plugins: [], template: 'starter', version: '1.0.0', billing: false })
  const on = nextsparkConfigSource({ plugins: ['x'], template: 'crm', version: '1.0.0', billing: true })
  assert.match(off, /\n  features: \{ billing: false \},\n/)
  assert.doesNotMatch(on, /features/)
  assert.match(on, /plugins: \["x"\],\n  template: \{ name: "crm", version: "1\.0\.0" \},\n\}\)\n$/)
})
