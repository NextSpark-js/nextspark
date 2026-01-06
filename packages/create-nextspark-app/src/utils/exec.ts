import { exec, type ExecOptions } from 'node:child_process'
import { promisify } from 'node:util'

const execPromise = promisify(exec)

export interface ExecResult {
  stdout: string
  stderr: string
}

export async function execAsync(
  command: string,
  options?: ExecOptions
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execPromise(command, {
      ...options,
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    })
    return { stdout, stderr }
  } catch (error) {
    if (error instanceof Error && 'stderr' in error) {
      throw new Error(`Command failed: ${command}\n${(error as any).stderr}`)
    }
    throw error
  }
}
