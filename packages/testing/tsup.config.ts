import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'selectors/index': 'src/selectors/index.ts',
    'utils/index': 'src/utils/index.ts',
    'pom/index': 'src/pom/index.ts',
    'helpers/index': 'src/helpers/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ['cypress'],
})
