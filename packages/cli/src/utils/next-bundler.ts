import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Bundler = 'webpack' | 'turbopack';

/**
 * Major version of the Next.js resolved from the project, or null when it
 * can't be determined (Next not installed yet, unreadable package.json).
 */
function majorOf(version: string | undefined): number | null {
  // Handles '15.5.24' as well as the ranges a package.json declares
  // ('^15.5.0', '~15.5', '>=14.0.0')
  const match = String(version).match(/(\d+)/);
  if (!match) return null;
  const major = Number.parseInt(match[1], 10);
  return Number.isNaN(major) ? null : major;
}

export function getNextMajorVersion(projectRoot: string): number | null {
  const projectPackageJson = join(projectRoot, 'package.json');

  // Installed version first: it is what will actually run
  try {
    const requireFromProject = createRequire(projectPackageJson);
    const pkgPath = requireFromProject.resolve('next/package.json');
    const { version } = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
    const major = majorOf(version);
    if (major !== null) return major;
  } catch {
    // Not installed yet — fall through to what the project declares
  }

  // Declared version: lets `build --webpack` still spell the flag correctly
  // before an install, rather than passing a flag the project's Next rejects
  try {
    const pkg = JSON.parse(readFileSync(projectPackageJson, 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return majorOf(pkg.dependencies?.next ?? pkg.devDependencies?.next);
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
 * escape hatch. Turbopack's own flag was `--turbo` before Next 15. Passing the
 * user's flag through verbatim would therefore break on one major or another,
 * so the choice is expressed here and spelled per version. With the version
 * unknown the flag is passed as written.
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

  if (bundler === 'webpack') {
    return [];
  }

  // Turbopack's flag was '--turbo' until Next 15 renamed it
  return major >= 15 ? ['--turbopack'] : ['--turbo'];
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
