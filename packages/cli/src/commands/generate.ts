import { prepareCommand } from './prepare.js';

interface GenerateOptions { watch?: boolean; }

/** Compatibility command: the same operation as `nextspark prepare` (`--watch` included). */
export async function generateCommand(options: GenerateOptions): Promise<void> {
  await prepareCommand({ watch: options.watch });
}
