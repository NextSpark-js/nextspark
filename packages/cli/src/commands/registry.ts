import chalk from '../utils/colors.js';
import { prepareCommand } from './prepare.js';

/**
 * `registry:build` and `registry:watch` are kept as names for `nextspark prepare` and
 * `nextspark prepare --watch`: the registries are generated together with src/app (#203), never alone.
 */

/** Build all registries (one-time generation): `nextspark prepare`. */
export async function registryBuildCommand(): Promise<void> {
  console.log(chalk.yellow('registry:build now runs nextspark prepare: src/app and the registries are generated together.'));
  await prepareCommand({});
}

/** Watch sources and regenerate src/app and the registries: `nextspark prepare --watch`. */
export async function registryWatchCommand(): Promise<void> {
  console.log(chalk.yellow('registry:watch now runs nextspark prepare --watch: src/app and the registries are generated together.'));
  await prepareCommand({ watch: true });
}
