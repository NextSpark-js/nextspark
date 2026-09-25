import { join } from 'node:path';
import fs from 'fs-extra';
import { readGeneratedTagAt } from '../../utils/generated-tag.js';
import { getNextMajorVersion } from '../../utils/next-bundler.js';
import {
  isGeneratedProxySource,
  planProxyFile,
  proxyDirectoryFor,
  type ProxyFileName,
} from '../../utils/proxy-file.js';

export interface ProxyFileResult {
  /** The file name that Next will load for this project. */
  fileName: 'proxy.ts' | 'middleware.ts';
  /** Path from the project root, including src/ when that is Next's convention root. */
  path: string;
  /** False when the project's own file was left in place instead. */
  written: boolean;
  /** Project-relative paths left alone because their content is not ours to replace. */
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
 * @param projectRoot - The Next project whose app/pages convention decides where the file lands.
 * @returns What happened, or null when the template has no proxy.ts.
 */
export async function writeProxyFile(
  templatesDir: string,
  projectRoot: string
): Promise<ProxyFileResult | null> {
  const sourcePath = join(templatesDir, 'proxy.ts');
  if (!await fs.pathExists(sourcePath)) return null;

  const source = await fs.readFile(sourcePath, 'utf-8');
  const directory = proxyDirectoryFor(projectRoot);
  const destinationDir = join(projectRoot, directory);

  const existing: Partial<Record<ProxyFileName, string>> = {};
  for (const name of ['proxy.ts', 'middleware.ts'] as const) {
    const path = join(destinationDir, name);
    if (await fs.pathExists(path)) existing[name] = await fs.readFile(path, 'utf-8');
  }

  const plan = planProxyFile(source, getNextMajorVersion(projectRoot), existing);
  if (plan.content !== null) {
    await fs.writeFile(join(destinationDir, plan.fileName), plan.content, 'utf-8');
  }
  if (plan.remove) {
    await fs.remove(join(destinationDir, plan.remove));
  }

  const preserved = plan.preserved.map(name => directory ? `${directory}/${name}` : name);
  const otherDirectory = directory ? '' : 'src';
  for (const name of ['proxy.ts', 'middleware.ts'] as const) {
    const relativePath = otherDirectory ? `${otherDirectory}/${name}` : name;
    const path = join(projectRoot, relativePath);
    if (!await fs.pathExists(path)) continue;
    const content = await fs.readFile(path, 'utf-8');
    const tag = readGeneratedTagAt(relativePath, Buffer.from(content));
    if (tag ? tag.intact : isGeneratedProxySource(content, source)) {
      await fs.remove(path);
    } else {
      preserved.push(relativePath);
    }
  }

  return {
    fileName: plan.fileName,
    path: directory ? `${directory}/${plan.fileName}` : plan.fileName,
    written: plan.content !== null,
    preserved,
  };
}
