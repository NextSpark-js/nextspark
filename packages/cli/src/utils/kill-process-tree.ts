import { spawnSync, type ChildProcess } from 'node:child_process';

/**
 * Ends `child` and everything it started (#469). Off Windows the child leads a process group of its own
 * (detached), so `kill(-pid)` reaches the whole group. Windows has no process groups and `kill(-pid)` throws
 * there, which left only the direct child ended and its git, node and pnpm running: `taskkill /T /F` ends the tree.
 * A process that is already gone is ignored. `platform` and `run` are injectable for the tests.
 */
export function killProcessTree(
  child: ChildProcess,
  platform: string = process.platform,
  run: typeof spawnSync = spawnSync,
  kill: (pid: number, signal: NodeJS.Signals) => void = (pid, signal) => { process.kill(pid, signal); },
): void {
  const pid = child.pid;
  if (!pid) return;
  if (platform === 'win32') {
    run('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 10_000 });
    return;
  }
  try {
    kill(-pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}
