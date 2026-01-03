'use server'

import { existsSync } from 'fs'
import { resolve } from 'path'

/**
 * Detecta si estamos en contexto de monorepo (desarrollo)
 * o en un proyecto que instaló el paquete via npm
 *
 * IMPORTANTE: Solo usar en contextos de servidor/build, NO en cliente
 */
export function isMonorepoContext(): boolean {
  const monorepoMarker = resolve(process.cwd(), '../../packages/core/package.json')
  return existsSync(monorepoMarker)
}

/**
 * Resuelve el path al core según el contexto
 */
export function resolveCorePath(relativePath: string): string {
  if (isMonorepoContext()) {
    return resolve(process.cwd(), '../../packages/core', relativePath)
  }
  return resolve(process.cwd(), 'node_modules/@nextsparkjs/core', relativePath)
}

/**
 * Resuelve paths para configs de test
 */
export function getTestPaths() {
  const isMonorepo = isMonorepoContext()

  return {
    isMonorepo,
    coreSrc: isMonorepo
      ? '../../packages/core/src'
      : '@nextsparkjs/core',
    coreTests: isMonorepo
      ? '../../packages/core/tests'
      : 'node_modules/@nextsparkjs/core/tests',
    cypressSupport: isMonorepo
      ? '../../packages/core/tests/cypress/support'
      : '@nextsparkjs/core/cypress-support',
    jestSetup: isMonorepo
      ? '../../packages/core/tests/jest/setup.ts'
      : '@nextsparkjs/core/jest-setup',
  }
}
