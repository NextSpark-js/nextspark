import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['./init.ts'],
  format: ['esm'],
  dts: false,
  outDir: './dist',
  clean: true,
  outExtension: () => ({ js: '.js' }),
  banner: {
    js: '#!/usr/bin/env node',
  },
})
