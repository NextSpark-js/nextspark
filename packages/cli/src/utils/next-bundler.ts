import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Bundler = 'webpack' | 'turbopack';

/**
 * Major version of the Next.js resolved from the project, or null when it
 * can't be determined (Next not installed yet, unreadable package.json).
 */
export function getNextMajorVersion(projectRoot: string): number | null {
  try {
    const requireFromProject = createRequire(join(projectRoot, 'package.json'));
    const pkgPath = requireFromProject.resolve('next/package.json');
    const { version } = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
    const major = Number.parseInt(String(version).split('.')[0], 10);
    return Number.isNaN(major) ? null : major;
  } catch {
    return null;
  }
}

/**
 * Translate "I want this bundler" into the flags the project's Next.js
 * actually understands.
 *
 * The spelling flipped with the default: up to Next 15 `next build`/`next dev`
 * run Webpack unless `--turbopack` is passed and reject an unknown `--webpack`;
 * from Next 16 Turbopack is the default and `--webpack` is the documented
 * escape hatch. Passing the user's flag through verbatim would therefore break
 * on one major or the other, so the choice is expressed here and spelled per
 * version. With the version unknown the flag is passed as written.
 */
export function resolveBundlerArgs(
  bundler: Bundler | undefined,
  projectRoot: string
): string[] {
  if (!bundler) {
    return [];
  }

  const major = getNextMajorVersion(projectRoot);

  if (major === null) {
    return [`--${bundler}`];
  }

  if (major >= 16) {
    return bundler === 'webpack' ? ['--webpack'] : [];
  }

  return bundler === 'turbopack' ? ['--turbopack'] : [];
}

/**
 * Resolve the bundler from the mutually exclusive CLI flags.
 * Throws when both are given, so the CLI can fail with a clear message
 * instead of silently picking one.
 */
export function pickBundler(options: {
  webpack?: boolean;
  turbopack?: boolean;
}): Bundler | undefined {
  if (options.webpack && options.turbopack) {
    throw new Error('Cannot use --webpack and --turbopack together: pick one bundler.');
  }
  if (options.webpack) return 'webpack';
  if (options.turbopack) return 'turbopack';
  return undefined;
}
