import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PRESET, getDefaultConfig, getPreset } from '../src/wizard/presets.js'
import { featureChoices } from '../src/wizard/prompts/features-config.js'

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
