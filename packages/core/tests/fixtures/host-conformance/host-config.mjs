/**
 * next.config for both hosts. The variant is selected by environment so one host directory
 * builds four ways and keeps each build's output: HOST_CACHE_MODE=isr|cc (cacheComponents off/on)
 * and HOST_BUNDLER=webpack|turbopack (only names the distDir; the bundler is the CLI flag).
 */
export function hostConfig() {
  const mode = process.env.HOST_CACHE_MODE ?? 'isr'
  const bundler = process.env.HOST_BUNDLER ?? 'webpack'
  if (!['isr', 'cc'].includes(mode)) throw new Error(`HOST_CACHE_MODE must be isr or cc, got ${mode}`)
  return {
    distDir: `.next-${bundler}-${mode}`,
    cacheComponents: mode === 'cc',
    // Mode-only routes are named page.isr.tsx / page.cc.tsx in both hosts.
    pageExtensions: [`${mode}.tsx`, `${mode}.ts`, 'tsx', 'ts'],
    // The shared source and the fake core live outside each host directory.
    experimental: { externalDir: true },
    generateBuildId: () => 'host-conformance',
    // Each variant type-checks only its own distDir's route types (tsconfig.<bundler>-<mode>.json).
    typescript: { tsconfigPath: `tsconfig.${bundler}-${mode}.json` },
  }
}
