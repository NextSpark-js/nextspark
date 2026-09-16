import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { basename, join, dirname, relative } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { getCoreDir, getProjectRoot } from '../utils/paths.js';
import {
  buildFailureLines,
  describeTemplatesChanges,
  planTemplatesChanges,
  runRegistryBuild,
  templatesTreeLines,
  type TemplatesPlanResult,
} from '../utils/registry-build.js';
import {
  ensureGeneratedPathsIgnored,
  generatedPathsOnDisk,
  gitignoreIsSymlink,
  missingGitignoreEntries,
  trackedTemplatesFiles,
  unignoredPaths,
} from '../utils/templates-gitignore.js';
import { applySyncPlan, readCoreVersion, readSyncInput, readTree } from '../utils/sync-files.js';
import { describeSyncPlan, nextSyncState, plannedAppFiles, planSync, type ReportLine } from '../utils/sync-plan.js';
import { writeSyncState } from '../utils/sync-state.js';

interface SyncAppOptions {
  dryRun?: boolean;
  force?: boolean;
  backup?: boolean;
  verbose?: boolean;
  /** Customized files to replace with core's version, from the project root. */
  overwrite?: string[];
  /** Asks whether to go ahead; the interactive prompt when absent. */
  confirm?: (message: string) => Promise<boolean>;
}

const REPORT_TONES: Record<ReportLine['tone'], (text: string) => string> = {
  change: chalk.white,
  warning: chalk.yellow,
  muted: chalk.gray,
};

/**
 * Copy a directory's files into another, keeping their relative paths. Nothing
 * already there is written over: a backup that can be overwritten is no backup.
 */
function backupDirectory(source: string, target: string): void {
  for (const [file, content] of readTree(source)) {
    const targetPath = join(target, file);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, content, { flag: 'wx' });
  }
}

/** The time as the backup directories carry it in their names. */
function backupStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * The start of the name of the directory for the copy of app/ that --backup
 * takes: the core version and the time. The suffix mkdtemp adds is what keeps two
 * runs apart when the clock doesn't: a second one within the same millisecond
 * would otherwise land on the first one's directory.
 */
function appBackupPrefix(coreVersion: string): string {
  return `app.backup.v${coreVersion}.${backupStamp()}-`;
}

/** A path as a warning names it: quoted when a control character in it, such as a newline, would break the line. */
function shownPath(path: string): string {
  return /[\u0000-\u001f\u007f]/.test(path) ? JSON.stringify(path) : path;
}

/** How many of the paths git still picks up are named without --verbose, past which they are counted. */
const UNIGNORED_SHOWN = 10;

const SYMLINKED_GITIGNORE = 'the project\'s .gitignore is a symlink, which git does not read, so sync:app leaves it as it is';

/**
 * What the confirmation prompt says a sync is about to change, or null when it
 * changes nothing: the files sync writes or removes, and what the registry build
 * run right after does to app/(templates), where it can replace and remove files
 * too.
 */
export function confirmationMessage(writeCount: number, templatesPlan: TemplatesPlanResult | null): string | null {
  const parts: string[] = [];
  if (writeCount > 0) {
    parts.push(`write or remove ${writeCount} file(s) to match core`);
  }

  if (templatesPlan?.status === 'planned' && templatesPlan.changes) {
    const { create, replace, remove } = templatesPlan.changes;
    const count = create.length + replace.length + remove.length;
    if (count > 0) {
      parts.push(`have the registry build write or remove ${count} file(s) in app/(templates), backing up the ${replace.length + remove.length} it replaces or removes`);
    }
  } else if (templatesPlan?.status === 'failed') {
    parts.push("have the registry build regenerate app/(templates), whose changes couldn't be worked out beforehand");
  }

  return parts.length > 0 ? `This will ${parts.join(', and ')}.` : null;
}

async function promptToConfirm(): Promise<boolean> {
  const { confirm } = await import('@inquirer/prompts');
  return confirm({ message: 'Proceed with sync?', default: true });
}

export async function syncAppCommand(options: SyncAppOptions): Promise<void> {
  const spinner = ora({ text: 'Preparing sync...', isSilent: options.dryRun }).start();

  try {
    const coreDir = getCoreDir();
    const projectRoot = getProjectRoot();
    const coreVersion = readCoreVersion(coreDir);

    // Templates directory in core
    const templatesDir = join(coreDir, 'templates', 'app');

    // Target app directory in project
    const appDir = join(projectRoot, 'app');

    // Verify templates directory exists
    if (!existsSync(templatesDir)) {
      spinner.fail('Templates directory not found in @nextsparkjs/core');
      console.error(chalk.red(`\n  Expected path: ${templatesDir}`));
      process.exit(1);
    }

    // Verify app directory exists (project must be initialized)
    if (!existsSync(appDir)) {
      spinner.fail('No /app directory found');
      console.error(chalk.red('\n  This project does not have an /app folder.'));
      console.error(chalk.yellow('  Run "nextspark init" first to initialize your project.\n'));
      process.exit(1);
    }

    spinner.text = 'Scanning template files...';

    const input = readSyncInput(coreDir, projectRoot, { overwrite: options.overwrite });
    const actions = planSync(input);
    const writes = actions.filter(({ kind }) => kind !== 'unchanged' && kind !== 'keep');

    // What the registry build then changes in app/(templates), for the dry run to name and the prompt to count
    const templatesPlan = options.dryRun || !options.force
      ? await planTemplatesChanges(coreDir, projectRoot, plannedAppFiles(actions))
      : null;

    spinner.succeed('Scan complete');

    console.log(chalk.cyan(`\n  Syncing /app with @nextsparkjs/core@${coreVersion}...\n`));

    if (options.dryRun) {
      console.log(chalk.yellow('  [DRY RUN] No changes will be made\n'));
    }

    if (input.usePprVariants) {
      console.log(chalk.cyan('  PPR detected (cacheComponents: true + Next.js 16) — using PPR templates'));
    }

    const replacing = new Set(actions.filter(({ backup }) => backup).map(({ path }) => path));
    const blocked = new Set(actions.filter(({ blockedBy }) => blockedBy).map(({ path }) => path));
    for (const path of input.overwrite) {
      if (blocked.has(path)) {
        console.log(chalk.yellow(`  ⚠ --overwrite ${path}: core's version of it can't be worked out for this project, so it is left as it is`));
      } else if (!replacing.has(path)) {
        console.log(chalk.yellow(`  ⚠ --overwrite ${path}: not a customized file sync:app manages, so there is nothing to replace`));
      }
    }

    // Confirmation prompt (unless --force or --dry-run)
    const confirmation = confirmationMessage(writes.length, templatesPlan);
    if (!options.force && !options.dryRun && confirmation) {
      console.log(chalk.yellow(`\n  ${confirmation}`));
      console.log(chalk.gray('  Run with --dry-run to preview changes, or --force to skip this prompt.\n'));

      let confirmed: boolean;
      try {
        confirmed = options.confirm ? await options.confirm('Proceed with sync?') : await promptToConfirm();
      } catch {
        console.error(chalk.red('\n  Failed to load confirmation prompt. Use --force to skip.\n'));
        process.exit(1);
      }

      if (!confirmed) {
        console.log(chalk.yellow('\n  Sync cancelled.\n'));
        process.exit(0);
      }
    }

    // --backup's directory is created before the .gitignore is written, and
    // stays empty until the lines are in; a dry run names one of the same core
    // version and time, with a placeholder for the suffix
    const appBackupDir = !options.backup
      ? null
      : options.dryRun
        ? `${appBackupPrefix(coreVersion)}XXXXXX`
        : basename(mkdtempSync(join(projectRoot, appBackupPrefix(coreVersion))));

    // The .gitignore comes before what this run is known to write: the copy of
    // app/, the files sync backs up before replacing them and, when the registry
    // build is planned - in a dry run, or in a run without --force - the files it
    // adds and backs up. Backups are asked about under a directory named for this
    // time, with a placeholder for the suffix each picks as it is created. A rule
    // that names that suffix or another time, and what the build writes unplanned,
    // are left to the check a run makes after the build
    const backedUpFiles = [
      ...actions.filter(({ backup }) => backup).map(({ path }) => path),
      ...(templatesPlan?.changes ? [...templatesPlan.changes.replace, ...templatesPlan.changes.remove] : []),
    ];
    const pathsBeforeWriting = [
      ...generatedPathsOnDisk(projectRoot),
      ...(templatesPlan?.changes?.create ?? []),
      ...backedUpFiles.map((file) => `.nextspark/backups/${backupStamp()}-XXXXXX/${file}`),
      ...(appBackupDir ? [...input.projectApp.keys()].map((file) => `${appBackupDir}/${file}`) : []),
    ];
    const addedGitignoreEntries = options.dryRun ? [] : ensureGeneratedPathsIgnored(projectRoot, pathsBeforeWriting);

    if (appBackupDir && !options.dryRun) {
      spinner.start('Creating backup...');
      backupDirectory(appDir, join(projectRoot, appBackupDir));
      spinner.succeed(`Backup created: ${appBackupDir}`);
    }

    let backedUp: string[] = [];
    let replacedFilesBackupDir: string | null = null;
    if (!options.dryRun) {
      ({ backedUp, backupDir: replacedFilesBackupDir } = applySyncPlan(projectRoot, actions, join(projectRoot, '.nextspark', 'backups')));
      writeSyncState(projectRoot, nextSyncState(actions, input));
    }

    for (const line of describeSyncPlan(actions, { dryRun: options.dryRun, verbose: options.verbose })) {
      console.log(REPORT_TONES[line.tone](`  ${line.text}`));
    }
    if (backedUp.length > 0 && replacedFilesBackupDir) {
      console.log(chalk.gray(`  Backed up ${backedUp.join(', ')} to ${relative(projectRoot, replacedFilesBackupDir)}`));
    }

    // app/(templates) is the registry build's output, regenerated from what was just synced
    const trackedTemplates = trackedTemplatesFiles(projectRoot);
    if (trackedTemplates.length > 0) {
      console.log(chalk.yellow(`  ⚠ app/(templates) is tracked by git (${trackedTemplates.length} file(s)), but every registry build rewrites it.`));
      console.log(chalk.gray('    To stop tracking it: git rm -r --cached "app/(templates)"'));
    }

    if (options.dryRun) {
      const missingEntries = missingGitignoreEntries(projectRoot, pathsBeforeWriting);
      if (missingEntries.length > 0 && gitignoreIsSymlink(projectRoot)) {
        console.log(chalk.yellow(`  ⚠ Would not add ${missingEntries.join(', ')} to .gitignore: ${SYMLINKED_GITIGNORE}`));
      } else if (missingEntries.length > 0) {
        console.log(chalk.gray(`  Would add ${missingEntries.join(', ')} to .gitignore`));
      }

      if (templatesPlan?.status === 'planned' && templatesPlan.changes) {
        const lines = describeTemplatesChanges(templatesPlan.changes);
        console.log(chalk.gray(
          lines.length > 0
            ? `  Would regenerate app/(templates) with the registry build, which would write or remove ${lines.length} file(s)`
            : '  Would regenerate app/(templates) with the registry build, which would leave it as it is'
        ));
        for (const line of lines) console.log(chalk.white(`    ${line}`));
      } else if (templatesPlan?.status === 'skipped') {
        console.log(chalk.gray(`  Would skip regenerating app/(templates): ${templatesPlan.reason}`));
      } else {
        const why = templatesPlan?.reason ? ` (${templatesPlan.reason})` : '';
        console.log(chalk.yellow(`  Would regenerate app/(templates) with the registry build, but what it would change there couldn't be worked out${why}; run "nextspark registry:build" to see why`));
      }
    } else {
      spinner.start('Regenerating app/(templates)...');
      const registry = await runRegistryBuild(coreDir, projectRoot);
      if (registry.status === 'built') {
        spinner.succeed('Regenerated app/(templates)');
      } else if (registry.status === 'skipped') {
        spinner.warn(`Skipped regenerating app/(templates): ${registry.reason}. Run "nextspark registry:build" once it is set.`);
      } else {
        spinner.fail('Could not regenerate app/(templates)');
      }
      for (const line of templatesTreeLines(registry.output)) {
        console.log(chalk.gray(`    ${line}`));
      }

      // The backups sync and the registry build name as they write, and the
      // files the build adds without a plan, are only known now: git is asked
      // about every file on disk under the entries, however many there are
      const written = generatedPathsOnDisk(projectRoot);
      addedGitignoreEntries.push(...ensureGeneratedPathsIgnored(projectRoot, written));
      if (addedGitignoreEntries.length > 0) {
        console.log(chalk.gray(`  Added ${[...new Set(addedGitignoreEntries)].join(', ')} to .gitignore`));
      }
      const unignored = unignoredPaths(projectRoot, written);
      if (unignored.length > 0) {
        const why = gitignoreIsSymlink(projectRoot) ? SYMLINKED_GITIGNORE : 'a .gitignore further down the tree un-ignores them';
        console.log(chalk.yellow(`  ⚠ git still picks up ${unignored.length} file(s) sync:app wrote: ${why}`));
        const shown = options.verbose ? unignored : unignored.slice(0, UNIGNORED_SHOWN);
        for (const path of shown) console.log(chalk.gray(`    ${shownPath(path)}`));
        if (unignored.length > shown.length) {
          console.log(chalk.gray(`    ... and ${unignored.length - shown.length} more; --verbose names every one`));
        }
      }

      // app/(templates) is the registry build's half of the sync: with it stale,
      // reporting success would leave the project's routes behind core's under a
      // zero exit code, which is what core's postinstall and CI both read.
      if (registry.status === 'failed') {
        for (const line of buildFailureLines(registry.output)) {
          console.error(chalk.red(`    ${line}`));
        }
        console.error(chalk.red('\n  Sync incomplete: /app now matches core, but app/(templates) was not regenerated.'));
        console.error(chalk.red('  Fix what the registry build reports above and run "nextspark registry:build".\n'));
        process.exitCode = 1;
        return;
      }
    }

    // Success message
    console.log(chalk.green('\n  ✅ Sync complete!\n'));
  } catch (error) {
    spinner.fail('Sync failed');
    if (error instanceof Error) {
      console.error(chalk.red(`\n  Error: ${error.message}\n`));
      if (options.verbose && error.stack) {
        console.error(chalk.gray(`  Stack trace:\n${error.stack}\n`));
      }
    }
    process.exit(1);
  }
}
