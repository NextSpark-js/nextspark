/**
 * The project env files core's scripts read, highest precedence first, as Next.js reads them: .env.local over .env,
 * and no .env.local when NODE_ENV is test. An exported variable beats both. The `nextspark` CLI uses the same list
 * (packages/cli/src/utils/env-files.ts). Next's .env.<mode> files are not read: these scripts have no Next mode.
 */
export function projectEnvFiles(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === 'test' ? ['.env'] : ['.env.local', '.env']
}
