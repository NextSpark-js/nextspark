/**
 * The worker process of jobs-worker.test.ts: runWorkerProcess with a handler that takes a few seconds and then
 * queries through lib/db. The test sends it SIGTERM while the handler runs.
 */
import fs from 'node:fs'
import { runWorkerProcess } from '../../../src/lib/jobs/run'
import { queryWithRLS } from '../../../src/lib/db'

const marks = process.env.JOBS_TEST_MARKS as string
const mark = (text: string) => fs.appendFileSync(marks, `${text}\n`)

await runWorkerProcess({
  config: {
    enabled: true,
    shutdownTimeout: 20,
    queues: { slow: { handler: 'test:slow', retryLimit: 0 } },
  },
  getHandler: name => {
    // the worker takes lib/db's signal handlers over before it asks for its first handler: none is left by then
    mark(`listeners:${process.listenerCount('SIGTERM')}`)
    return name === 'test:slow'
      ? {
          name,
          handler: async () => {
            mark('started')
            await new Promise(resolve => setTimeout(resolve, 3000))
            // after SIGTERM: the pools must still be open, and the handler runs as the app role, not the pg-boss role
            const rows = await queryWithRLS<{ role: string }>('SELECT current_user AS role', [], null)
            mark(`done:${rows[0].role}`)
          },
        }
      : undefined
  },
})
mark('ready')
