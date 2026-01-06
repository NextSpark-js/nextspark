import chalk from 'chalk';
import { runDoctorCommand } from '../doctor/index.js';

export async function doctorCommand(): Promise<void> {
  try {
    await runDoctorCommand();
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}
