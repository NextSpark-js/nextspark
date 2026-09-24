/** Discover the optional project request hook. */

import { readFile, stat } from 'fs/promises'
import { join } from 'path'

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { verbose } from '../../../utils/index.mjs'

export async function discoverMiddlewares(config = DEFAULT_CONFIG) {
  const hookPath = join(config.projectSourceDir, 'config', 'hooks', 'proxy.ts')
  try {
    await stat(hookPath)
    const contents = await readFile(hookPath, 'utf8')
    if (!/export\s+(?:async\s+)?(?:function|const)\s+proxyHook\b/.test(contents)) {
      throw new Error('config/hooks/proxy.ts must export a named proxyHook')
    }
    verbose('Found project proxy hook')
    return [{
      themeName: config.projectName,
      middleware: null,
      middlewarePath: '@/config/hooks/proxy',
      middlewareExportName: 'proxyHook',
      exists: true,
    }]
  } catch (error) {
    if (error?.code === 'ENOENT') {
      verbose('No config/hooks/proxy.ts project hook found')
      return []
    }
    throw error
  }
}
