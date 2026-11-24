import { defineConfig } from '@nextsparkjs/core/lib/config'

export default defineConfig({
  plugins: ['@nextsparkjs/plugin-langchain'],
  // MCP browser sign-in (#541): opt-in. This app builds it when MCP_OAUTH_ENABLED=true is set for the build.
  features: { mcpOAuth: process.env.MCP_OAUTH_ENABLED === 'true' },
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
