import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { getCoreDir, getProjectRoot } from '../utils/paths.js';
import { runRegistryBuild, templatesTreeLines } from '../utils/registry-build.js';
import { ensureGeneratedPathsIgnored, missingGitignoreEntries, trackedTemplatesFiles } from '../utils/templates-gitignore.js';
import { applySyncPlan, readCoreVersion, readSyncInput, readTree } from '../utils/sync-files.js';
import { describeSyncPlan, nextSyncState, planSync, type ReportLine } from '../utils/sync-plan.js';
import { writeSyncState } from '../utils/sync-state.js';

interface SyncAppOptions {
  dryRun?: boolean;
  force?: boolean;
  backup?: boolean;
  verbose?: boolean;
  /** Customized files to replace with core's version, from the project root. */
  overwrite?: string[];
}

const REPORT_TONES: Record<ReportLine['tone'], (text: string) => string> = {
  change: chalk.white,
  warning: chalk.yellow,
  muted: chalk.gray,
};

/**
 * Copy a directory's files into another, keeping their relative paths
 */
function backupDirectory(source: string, target: string): void {
  for (const [file, content] of readTree(source)) {
    const targetPath = join(target, file);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, content);
  }
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

    spinner.succeed('Scan complete');

    console.log(chalk.cyan(`\n  Syncing /app with @nextsparkjs/core@${coreVersion}...\n`));

    if (options.dryRun) {
      console.log(chalk.yellow('  [DRY RUN] No changes will be made\n'));
    }

    if (input.usePprVariants) {
      console.log(chalk.cyan('  PPR detected (cacheComponents: true + Next.js 16) — using PPR templates'));
    }

    const replacing = new Set(actions.filter(({ backup }) => backup).map(({ path }) => path));
    for (const path of input.overwrite) {
      if (!replacing.has(path)) {
        console.log(chalk.yellow(`  ⚠ --overwrite ${path}: not a customized file sync:app manages, so there is nothing to replace`));
      }
    }

    // Confirmation prompt (unless --force or --dry-run)
    if (!options.force && !options.dryRun && writes.length > 0) {
      console.log(chalk.yellow(`\n  This will write or remove ${writes.length} file(s) to match core.`));
      console.log(chalk.gray('  Run with --dry-run to preview changes, or --force to skip this prompt.\n'));

      try {
        const { confirm } = await import('@inquirer/prompts');
        const confirmed = await confirm({
          message: 'Proceed with sync?',
          default: true,
        });

        if (!confirmed) {
          console.log(chalk.yellow('\n  Sync cancelled.\n'));
          process.exit(0);
        }
      } catch (promptError) {
        console.error(chalk.red('\n  Failed to load confirmation prompt. Use --force to skip.\n'));
        process.exit(1);
      }
    }

    // Perform backup if requested
    if (options.backup && !options.dryRun) {
      const backupDir = join(projectRoot, `app.backup.v${coreVersion}.${Date.now()}`);
      spinner.start('Creating backup...');
      backupDirectory(appDir, backupDir);
      spinner.succeed(`Backup created: ${relative(projectRoot, backupDir)}`);
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
      const missingEntries = missingGitignoreEntries(projectRoot);
      if (missingEntries.length > 0) {
        console.log(chalk.gray(`  Would add ${missingEntries.join(', ')} to .gitignore`));
      }
      console.log(chalk.gray('  Would regenerate app/(templates) with the registry build'));
    } else {
      const addedEntries = ensureGeneratedPathsIgnored(projectRoot);
      if (addedEntries.length > 0) {
        console.log(chalk.gray(`  Added ${addedEntries.join(', ')} to .gitignore`));
      }

      spinner.start('Regenerating app/(templates)...');
      const registry = await runRegistryBuild(coreDir, projectRoot);
      if (registry.status === 'built') {
        spinner.succeed('Regenerated app/(templates)');
      } else if (registry.status === 'skipped') {
        spinner.warn(`Skipped regenerating app/(templates): ${registry.reason}. Run "nextspark registry:build" once it is set.`);
      } else {
        spinner.warn('Could not regenerate app/(templates); run "nextspark registry:build" to see why.');
      }
      for (const line of templatesTreeLines(registry.output)) {
        console.log(chalk.gray(`    ${line}`));
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
