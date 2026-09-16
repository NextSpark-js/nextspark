import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { basename, join, dirname, relative } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { getCoreDir, getProjectRoot } from '../utils/paths.js';
import {
  buildFailureLines,
  describeTemplatesChanges,
  planTemplatesChanges,
  registryBuildBlocker,
  runRegistryBuild,
  templatesTreeLines,
  type TemplatesPlanResult,
} from '../utils/registry-build.js';
import {
  BACKUPS_GITIGNORE,
  backupsGitignoreState,
  ensureBackupsGitignore,
  ensureGeneratedPathsIgnored,
  generatedPathsOnDisk,
  planGitignore,
  TEMPLATES_GITIGNORE_ENTRY,
  trackedTemplatesFiles,
  unsafeWritePlaces,
  unignoredPaths,
} from '../utils/templates-gitignore.js';
import { applySyncPlan, readCoreVersion, readSyncInput, readTree } from '../utils/sync-files.js';
import { describeSyncPlan, nextSyncState, plannedAppFiles, planSync, type ReportLine } from '../utils/sync-plan.js';
import { writeSyncState } from '../utils/sync-state.js';
import { shownPath } from '../utils/shown-path.js';

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

/** How many of the paths git still picks up are named without --verbose, past which they are counted. */
const UNIGNORED_SHOWN = 10;

/** The copy of app/ that --backup takes, whose directory the .gitignore entry covers whatever it is named. */
const APP_BACKUP_ENTRY = 'app.backup.v*/';

/** The backups under .nextspark/backups, which the .gitignore sync:app keeps in that directory covers whatever the rest reads. */
const BACKUPS_ENTRY = '.nextspark/backups/';

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
      console.error(chalk.red(`\n  Expected path: ${shownPath(templatesDir)}`));
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

    // Neither a dry run nor a run goes on where it can't write safely: through a
    // symlink, what is written, replaced or removed lands wherever it points,
    // blind to what is there and where the .gitignore can't reach, and a file or
    // directory in the way stops a run halfway
    const unsafe = unsafeWritePlaces(projectRoot, writes.map(({ path }) => path));
    if (unsafe.length > 0) {
      spinner.fail("Sync not started: sync:app can't write safely under these paths");
      console.error(chalk.red('\n  sync:app and the registry build write under these paths:'));
      for (const { path, problem } of unsafe) console.error(chalk.red(`    ${shownPath(path)} ${problem}`));
      console.error(chalk.red("  Through a symlink, what they write, replace or remove lands wherever it points, and git can't tell whether it is ignored."));
      console.error(chalk.yellow('  Make each one a directory or file of its own, of the kind that goes there, and run sync:app again.\n'));
      process.exitCode = 1;
      return;
    }

    // The backups sync and the registry build take under .nextspark/backups are
    // kept out of git by that directory's own .gitignore, put in place before
    // the first one is written, whatever each is named or holds. One already
    // there that is a symlink, which git does not read, or that has patterns
    // other than `*`, which can take a backup back, is the project's: nothing is
    // written until it is fixed
    const buildRuns = registryBuildBlocker(projectRoot) === null;
    const backsUpUnderNextspark = buildRuns
      || actions.some(({ path, backup }) => backup && existsSync(join(projectRoot, path)));
    const backupsGitignore = backsUpUnderNextspark ? backupsGitignoreState(projectRoot) : null;
    if (backupsGitignore === 'symlink' || backupsGitignore === 'other') {
      spinner.fail(`Sync not started: ${BACKUPS_GITIGNORE} would not keep the backups out of git`);
      console.error(chalk.red(backupsGitignore === 'symlink'
        ? `\n  ${BACKUPS_GITIGNORE} is a symlink, which git does not read, and sync:app and the registry build back files up there.`
        : `\n  ${BACKUPS_GITIGNORE} has patterns other than *, which can take a backup back into git, and sync:app and the registry build back files up there.`));
      console.error(chalk.yellow('  Leave * as its only pattern, or remove it for sync:app to write it, and run sync:app again.\n'));
      process.exitCode = 1;
      return;
    }

    // What sync:app writes is kept out of git by .gitignore files as git reads
    // them, decided before anything is written: the lines it adds go at the
    // end of the project's .gitignore, and a place it writes this run that git
    // would still pick up with them in - taken back by a .gitignore further
    // down, or under a project .gitignore that is a symlink - stops the run
    // here, in a dry run too. The backups are left to their own .gitignore
    const gitignorePlan = planGitignore(projectRoot);
    const writtenThisRun = (entry: string) =>
      entry === TEMPLATES_GITIGNORE_ENTRY ? buildRuns : entry === APP_BACKUP_ENTRY ? options.backup === true : entry !== BACKUPS_ENTRY;
    const leftForGit = gitignorePlan.leftForGit.filter(({ entry }) => writtenThisRun(entry));
    if (leftForGit.length > 0) {
      spinner.fail('Sync not started: git would pick up what sync:app writes');
      console.error(chalk.red('\n  With the lines sync:app adds to .gitignore, git would still pick up what goes under:'));
      for (const { entry, why } of leftForGit) console.error(chalk.red(`    ${entry}: ${shownPath(why)}`));
      console.error(chalk.yellow('  Make git leave each one out - drop the rule that takes it back, or make .gitignore a file of its own - and run sync:app again.\n'));
      process.exitCode = 1;
      return;
    }
    const notAdded = gitignorePlan.leftForGit.filter(({ entry }) => !writtenThisRun(entry) && entry !== BACKUPS_ENTRY);

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
        console.log(chalk.yellow(`  ⚠ --overwrite ${shownPath(path)}: core's version of it can't be worked out for this project, so it is left as it is`));
      } else if (!replacing.has(path)) {
        console.log(chalk.yellow(`  ⚠ --overwrite ${shownPath(path)}: not a customized file sync:app manages, so there is nothing to replace`));
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

    // The .gitignore lines come before anything they keep out is written
    const addedGitignoreEntries = options.dryRun ? [] : ensureGeneratedPathsIgnored(projectRoot);

    const addsBackupsGitignore = backupsGitignore === 'missing';
    if (addsBackupsGitignore && !options.dryRun) {
      ensureBackupsGitignore(projectRoot);
    }

    let appBackupDir: string | null = null;
    if (options.backup && !options.dryRun) {
      spinner.start('Creating backup...');
      appBackupDir = basename(mkdtempSync(join(projectRoot, appBackupPrefix(coreVersion))));
      backupDirectory(appDir, join(projectRoot, appBackupDir));
      spinner.succeed(`Backup created: ${shownPath(appBackupDir)}`);
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
      console.log(chalk.gray(`  Backed up ${backedUp.map(shownPath).join(', ')} to ${shownPath(relative(projectRoot, replacedFilesBackupDir))}`));
    }

    // app/(templates) is the registry build's output, regenerated from what was just synced
    const trackedTemplates = trackedTemplatesFiles(projectRoot);
    if (trackedTemplates.length > 0) {
      console.log(chalk.yellow(`  ⚠ app/(templates) is tracked by git (${trackedTemplates.length} file(s)), but every registry build rewrites it.`));
      console.log(chalk.gray('    To stop tracking it: git rm -r --cached "app/(templates)"'));
    }

    for (const { entry, why } of notAdded) {
      console.log(chalk.yellow(`  ⚠ ${options.dryRun ? 'Would not add' : 'Did not add'} ${entry} to .gitignore, and git would pick up what goes under it: ${shownPath(why)}`));
    }

    if (options.dryRun) {
      if (gitignorePlan.add.length > 0) {
        console.log(chalk.gray(`  Would add ${gitignorePlan.add.join(', ')} to .gitignore`));
      }
      if (addsBackupsGitignore) {
        console.log(chalk.gray(`  Would add ${BACKUPS_GITIGNORE}, which keeps every backup there out of git`));
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
      // The build's own lines name paths too, and are shown one by one the way a path is
      for (const line of templatesTreeLines(registry.output)) {
        console.log(chalk.gray(`    ${shownPath(line)}`));
      }

      if (addedGitignoreEntries.length > 0) {
        console.log(chalk.gray(`  Added ${addedGitignoreEntries.join(', ')} to .gitignore`));
      }
      if (addsBackupsGitignore) {
        console.log(chalk.gray(`  Added ${BACKUPS_GITIGNORE}, which keeps every backup there out of git`));
      }

      // Git is asked about every file this run left on disk under the entries,
      // however many there are. The rules as they stood before anything was
      // written leave them all out, so one git picks up now means a .gitignore
      // changed while the sync ran, and the sync has not done its part
      const written = generatedPathsOnDisk(projectRoot).filter((path) => path.startsWith('app.backup.v')
        ? appBackupDir !== null && path.startsWith(`${appBackupDir}/`)
        : !path.startsWith('app/(templates)/') || registry.status !== 'skipped');
      const unignored = unignoredPaths(projectRoot, written);
      if (unignored.length > 0) {
        console.error(chalk.red(`\n  Sync incomplete: git picks up ${unignored.length} file(s) sync:app and the registry build wrote, which the .gitignore files left out before the sync wrote anything:`));
        const shown = options.verbose ? unignored : unignored.slice(0, UNIGNORED_SHOWN);
        for (const path of shown) console.error(chalk.red(`    ${shownPath(path)}`));
        if (unignored.length > shown.length) {
          console.error(chalk.red(`    ... and ${unignored.length - shown.length} more; --verbose names every one`));
        }
        console.error(chalk.yellow('  A .gitignore changed while the sync ran. Make git leave them out, and run sync:app again.\n'));
        process.exitCode = 1;
      }

      // app/(templates) is the registry build's half of the sync: with it stale,
      // reporting success would leave the project's routes behind core's under a
      // zero exit code, which is what core's postinstall and CI both read.
      if (registry.status === 'failed') {
        for (const line of buildFailureLines(registry.output)) {
          console.error(chalk.red(`    ${shownPath(line)}`));
        }
        console.error(chalk.red('\n  Sync incomplete: /app now matches core, but app/(templates) was not regenerated.'));
        console.error(chalk.red('  Fix what the registry build reports above and run "nextspark registry:build".\n'));
        process.exitCode = 1;
        return;
      }
      if (unignored.length > 0) return;
    }

    // Success message
    console.log(chalk.green('\n  ✅ Sync complete!\n'));
  } catch (error) {
    spinner.fail('Sync failed');
    if (error instanceof Error) {
      console.error(chalk.red(`\n  Error: ${shownPath(error.message)}\n`));
      if (options.verbose && error.stack) {
        console.error(chalk.gray(`  Stack trace:\n${error.stack}\n`));
      }
    }
    process.exit(1);
  }
}
