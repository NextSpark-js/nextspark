import { defineConfig } from '@nextsparkjs/core/lib/config'

export default defineConfig({
  plugins: ['@nextsparkjs/plugin-langchain'],
  billing: {
    webhookExtensions: {
      stripe: './lib/billing/stripe-webhook-extensions',
      polar: './lib/billing/polar-webhook-extensions',
    },
  },
  template: {
    name: 'default',
    version: '0.1.0-beta.192',
  },
})
