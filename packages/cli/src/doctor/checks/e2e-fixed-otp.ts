/**
 * Fixed E2E sign-in code Health Check (#460)
 *
 * Warns when NEXTSPARK_E2E_FIXED_OTP is in an env file a production build loads: next build and next start read
 * .env, .env.local, .env.production and .env.production.local, so the fixed code would reach every production build
 * made from that checkout. Core refuses it only where VERCEL_ENV=production. The value is never shown.
 */

import fs from 'fs-extra'
import path from 'path'
import type { HealthCheckResult } from '../index.js'
import { parseEnvFile } from './database.js'

const VARIABLE = 'NEXTSPARK_E2E_FIXED_OTP'
/** The env files Next.js loads in production mode. */
const PRODUCTION_ENV_FILES = ['.env', '.env.local', '.env.production', '.env.production.local']

export async function checkE2eFixedOtp(cwd = process.cwd()): Promise<HealthCheckResult> {
  const name = 'E2E sign-in code'
  const files: string[] = []
  for (const file of PRODUCTION_ENV_FILES) {
    const text = await fs.readFile(path.join(cwd, file), 'utf-8').catch(() => '')
    if (parseEnvFile(text)[VARIABLE]) files.push(file)
  }
  if (files.length === 0) return { name, status: 'pass', message: `${VARIABLE} is not in an env file a production build loads` }
  return {
    name,
    status: 'warn',
    code: 'NS_E2E_FIXED_OTP_IN_ENV_FILE',
    message: `NS_E2E_FIXED_OTP_IN_ENV_FILE: ${files.join(', ')} ${files.length > 1 ? 'set' : 'sets'} ${VARIABLE}, which a production build loads: every production build made here accepts the fixed sign-in code`,
    fix: `Move ${VARIABLE} to .env.development.local (development only) or pass it in the E2E run's command; for a deployed preview, set it in that environment only`,
  }
}
