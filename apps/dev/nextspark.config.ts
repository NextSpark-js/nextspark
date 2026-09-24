import { defineConfig } from '@nextsparkjs/core/lib/config'

export default defineConfig({
  plugins: ['@nextsparkjs/plugin-langchain'],
  template: {
    name: 'default',
    version: '0.1.0-beta.192',
  },
})
