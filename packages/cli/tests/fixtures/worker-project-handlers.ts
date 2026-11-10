// Copied to lib/scheduled-actions/index.ts of a generated project by worker-packaged-project.test.ts (and by the CI step
// that runs it): a handler module that imports core the documented way and registers one handler.
import { registerScheduledAction } from '@nextsparkjs/core/lib/scheduled-actions'

export function registerAllHandlers(): void {
  registerScheduledAction('worker-check:ping', async () => {
    console.log('[worker-check] ping handled')
  })
}

export async function registerRecurringActions(): Promise<void> {}
