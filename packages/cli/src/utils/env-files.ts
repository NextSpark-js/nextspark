/**
 * The project env files the CLI reads, highest precedence first, as Next.js reads them: .env.local over .env, and no
 * .env.local when NODE_ENV is test. An exported variable beats both. Core's scripts use the same list
 * (packages/core/scripts/utils/env-files.mjs). Next's .env.<mode> files are not read: the CLI's commands have no Next mode.
 */
export function projectEnvFiles(nodeEnv: string | undefined = process.env.NODE_ENV): string[] {
  return nodeEnv === 'test' ? ['.env'] : ['.env.local', '.env']
}
