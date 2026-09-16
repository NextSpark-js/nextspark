import { execSync } from 'child_process'

/**
 * Rebuilds every registry (the docs registry included) after update-core.mjs
 * copies files in. Takes the runner as a parameter so a test can hand it one
 * that fails without shelling out for real. A failed rebuild is reported to
 * the caller rather than swallowed, so it can flip the exit code instead of
 * being announced as a successful update.
 */
export function rebuildRegistries(runner = execSync) {
  try {
    runner('node core/scripts/build/registry.mjs --build', { stdio: 'inherit' })
    return true
  } catch (error) {
    console.error('   Warning: Registry rebuild failed')
    return false
  }
}
