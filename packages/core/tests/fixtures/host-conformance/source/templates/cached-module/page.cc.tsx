'use cache'

import { cacheLife } from 'next/cache'

export default async function CachedModulePage() {
  cacheLife('days')
  return <p data-probe="cached-module">Module-level cache at {new Date().toISOString()}</p>
}
