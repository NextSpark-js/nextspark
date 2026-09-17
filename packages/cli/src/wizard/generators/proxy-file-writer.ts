import { join } from 'node:path';
import fs from 'fs-extra';
import { getNextMajorVersion } from '../../utils/next-bundler.js';
import { planProxyFile, type ProxyFileName } from '../../utils/proxy-file.js';

export interface ProxyFileResult {
  /** The file name that Next will load for this project. */
  fileName: 'proxy.ts' | 'middleware.ts';
  /** False when the project's own file was left in place instead. */
  written: boolean;
  /** Files left alone because their content is not ours to replace. */
  preserved: string[];
}

/**
 * Copy the template's proxy.ts into the project under the right name, removing
 * the other spelling so a project that changed Next major does not end up with
 * both files.
 *
 * Anything that does not match the template verbatim is left where it is: it
 * belongs to the project, and this reports it so the caller can say so.
 *
 * @param templatesDir - The core package's templates directory.
 * @param projectRoot - Where the file should land.
 * @returns What happened, or null when the template has no proxy.ts.
 */
export async function writeProxyFile(
  templatesDir: string,
  projectRoot: string
): Promise<ProxyFileResult | null> {
  const sourcePath = join(templatesDir, 'proxy.ts');
  if (!await fs.pathExists(sourcePath)) return null;

  const existing: Partial<Record<ProxyFileName, string>> = {};
  for (const name of ['proxy.ts', 'middleware.ts'] as const) {
    const path = join(projectRoot, name);
    if (await fs.pathExists(path)) existing[name] = await fs.readFile(path, 'utf-8');
  }

  const plan = planProxyFile(await fs.readFile(sourcePath, 'utf-8'), getNextMajorVersion(projectRoot), existing);
  if (plan.content !== null) {
    await fs.writeFile(join(projectRoot, plan.fileName), plan.content, 'utf-8');
  }
  if (plan.remove) {
    await fs.remove(join(projectRoot, plan.remove));
  }

  return { fileName: plan.fileName, written: plan.content !== null, preserved: plan.preserved };
}
