/**
 * Next.js instrumentation: runs once when the server starts. This file is
 * yours: core's register() checks the login providers and starts scheduled
 * actions, and is updated with @nextsparkjs/core.
 *
 * To run startup code of your own, call it from your register():
 *   import { register as registerNextSpark } from '@nextsparkjs/core/instrumentation'
 *   export async function register() {
 *     await registerNextSpark()
 *     // your code
 *   }
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export { register } from '@nextsparkjs/core/instrumentation'
