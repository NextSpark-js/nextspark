import { execSync } from 'child_process'
import { mkdtempSync, readdirSync, rmSync, existsSync, readFileSync, copyFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, isAbsolute } from 'path'
import * as tar from 'tar'
import type { NextSparkPackageJson, FetchResult } from '../types/nextspark-package.js'

export async function fetchPackage(
  packageSpec: string,
  version?: string
): Promise<FetchResult> {
  // Detectar si es path local
  if (packageSpec.endsWith('.tgz') || packageSpec.startsWith('./') || packageSpec.startsWith('/') || isAbsolute(packageSpec)) {
    return fetchLocalPackage(packageSpec)
  }

  return fetchNpmPackage(packageSpec, version)
}

async function fetchLocalPackage(filePath: string): Promise<FetchResult> {
  const absolutePath = isAbsolute(filePath)
    ? filePath
    : join(process.cwd(), filePath)

  if (!existsSync(absolutePath)) {
    throw new Error(`Local package not found: ${absolutePath}`)
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'nextspark-add-'))

  try {
    // Copiar .tgz a temp y extraer
    const tgzPath = join(tempDir, 'package.tgz')
    copyFileSync(absolutePath, tgzPath)

    await tar.x({
      file: tgzPath,
      cwd: tempDir,
    })

    const extractedPath = join(tempDir, 'package')
    const packageJson = JSON.parse(
      readFileSync(join(extractedPath, 'package.json'), 'utf-8')
    )

    return {
      packageJson,
      extractedPath,
      cleanup: () => rmSync(tempDir, { recursive: true, force: true })
    }
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true })
    throw error
  }
}

async function fetchNpmPackage(
  packageName: string,
  version?: string
): Promise<FetchResult> {
  const spec = version ? `${packageName}@${version}` : packageName
  const tempDir = mkdtempSync(join(tmpdir(), 'nextspark-add-'))

  try {
    console.log(`  Downloading ${spec}...`)

    // npm pack descarga el .tgz sin instalar
    execSync(`npm pack ${spec} --pack-destination "${tempDir}"`, {
      stdio: 'pipe',
      encoding: 'utf-8'
    })

    const tgzFile = readdirSync(tempDir).find(f => f.endsWith('.tgz'))
    if (!tgzFile) {
      throw new Error(`Failed to download package: ${spec}`)
    }

    await tar.x({
      file: join(tempDir, tgzFile),
      cwd: tempDir,
    })

    const extractedPath = join(tempDir, 'package')

    if (!existsSync(extractedPath)) {
      throw new Error(`Package extraction failed for: ${spec}`)
    }

    const packageJson = JSON.parse(
      readFileSync(join(extractedPath, 'package.json'), 'utf-8')
    )

    return {
      packageJson,
      extractedPath,
      cleanup: () => rmSync(tempDir, { recursive: true, force: true })
    }
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true })

    // Mejorar mensaje de error
    if (error instanceof Error) {
      if (error.message.includes('404') || error.message.includes('not found')) {
        throw new Error(`Package not found: ${spec}. Verify the package name exists on npm.`)
      }
      if (error.message.includes('ENETUNREACH') || error.message.includes('ENOTFOUND')) {
        throw new Error(`Network error. Check your internet connection.`)
      }
    }
    throw error
  }
}
