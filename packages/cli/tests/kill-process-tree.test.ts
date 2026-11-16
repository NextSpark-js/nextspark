import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChildProcess, spawnSync } from 'node:child_process';
import { killProcessTree } from '../src/utils/kill-process-tree.js';

const fake = (pid: number | undefined) => {
  const killed: string[] = [];
  return { child: { pid, kill: (signal: string) => { killed.push(signal); return true; } } as unknown as ChildProcess, killed };
};

test('on Windows the whole process tree is ended with taskkill /T /F, and nothing else is signalled (#469)', () => {
  const { child, killed } = fake(4242);
  const calls: Array<[string, readonly string[], Record<string, unknown>]> = [];
  const run = ((command: string, args: string[], options: Record<string, unknown>) => { calls.push([command, args, options]); return {}; }) as unknown as typeof spawnSync;
  const signals: Array<[number, string]> = [];
  killProcessTree(child, 'win32', run, (pid, signal) => { signals.push([pid, signal]); });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'taskkill');
  assert.deepEqual(calls[0][1], ['/pid', '4242', '/T', '/F']);
  assert.equal(calls[0][2].windowsHide, true);
  assert.deepEqual(signals, []);
  assert.deepEqual(killed, []);
});

test('off Windows the process group is killed with kill(-pid), as before, and the child alone only when that fails (#469)', () => {
  for (const platform of ['linux', 'darwin']) {
    const { child, killed } = fake(4242);
    const signals: Array<[number, string]> = [];
    const run = (() => { throw new Error('taskkill must not run'); }) as unknown as typeof spawnSync;
    killProcessTree(child, platform, run, (pid, signal) => { signals.push([pid, signal]); });
    assert.deepEqual(signals, [[-4242, 'SIGKILL']], platform);
    assert.deepEqual(killed, [], platform);

    const gone = fake(4242);
    killProcessTree(gone.child, platform, run, () => { throw new Error('ESRCH'); });
    assert.deepEqual(gone.killed, ['SIGKILL'], platform);
  }
});

test('a child that never started has nothing to kill', () => {
  const { child } = fake(undefined);
  const run = (() => { throw new Error('must not run'); }) as unknown as typeof spawnSync;
  killProcessTree(child, 'win32', run, () => { throw new Error('must not run'); });
});
