import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { getCoreDir, getProjectRoot } from '../utils/paths.js';

/**
 * Load environment variables from project root .env file
 */
function loadProjectEnv(projectRoot: string): Record<string, string> {
  const envPath = join(projectRoot, '.env');
  const envVars: Record<string, string> = {};

  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=');
          // Remove surrounding quotes
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          envVars[key] = value;
        }
      }
    }
  }

  return envVars;
}

/**
 * Run database migrations
 */
export async function dbMigrateCommand(): Promise<void> {
  const spinner = ora('Preparing to run migrations...').start();

  try {
    const coreDir = getCoreDir();
    const projectRoot = getProjectRoot();

    // Validate that core package exists
    const migrationsScript = join(coreDir, 'scripts', 'db', 'run-migrations.mjs');
    if (!existsSync(migrationsScript)) {
      spinner.fail('Migrations script not found');
      console.error(chalk.red(`Expected script at: ${migrationsScript}`));
      process.exit(1);
    }

    spinner.succeed('Core package found');

    // Load project .env file
    const projectEnv = loadProjectEnv(projectRoot);

    // Validate required environment variables
    if (!projectEnv.DATABASE_URL) {
      spinner.fail('DATABASE_URL not found in .env file');
      console.error(chalk.red('Please configure DATABASE_URL in your .env file'));
      process.exit(1);
    }

    if (!projectEnv.NEXT_PUBLIC_ACTIVE_THEME) {
      spinner.fail('NEXT_PUBLIC_ACTIVE_THEME not found in .env file');
      console.error(chalk.red('Please configure NEXT_PUBLIC_ACTIVE_THEME in your .env file'));
      process.exit(1);
    }

    spinner.start('Running database migrations...');

    const migrateProcess = spawn('node', [migrationsScript], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...projectEnv,
        ...process.env,
        NEXTSPARK_PROJECT_ROOT: projectRoot,
        NEXTSPARK_CORE_DIR: coreDir,
      },
    });

    migrateProcess.on('error', (err) => {
      spinner.fail('Migration failed');
      console.error(chalk.red(err.message));
      process.exit(1);
    });

    migrateProcess.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('\n✅ Migrations completed successfully!'));
        process.exit(0);
      } else {
        console.error(chalk.red(`\n❌ Migrations failed with exit code ${code}`));
        process.exit(code ?? 1);
      }
    });
  } catch (error) {
    spinner.fail('Migration preparation failed');
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }
    process.exit(1);
  }
}

/**
 * Seed the database with sample data
 * Note: This runs the same migration script as db:migrate,
 * which handles sample data as part of the migration process.
 */
export async function dbSeedCommand(): Promise<void> {
  console.log(chalk.cyan('ℹ️  Sample data is included as part of the migration process.'));
  console.log(chalk.cyan('   Running db:migrate to apply all migrations including sample data...\n'));

  await dbMigrateCommand();
}
