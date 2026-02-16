/**
 * Chat MCP Tools
 *
 * File manipulation tools for post-generation iterative chat.
 * All operations are sandboxed to the project directory.
 */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import type { StudioEventHandler } from '../../types'

/**
 * Validate that a resolved path is within the project directory.
 * Prevents path traversal attacks.
 */
function assertWithinProject(filePath: string, projectDir: string): string {
  const resolved = path.resolve(projectDir, filePath)
  const normalizedProject = path.resolve(projectDir)
  if (!resolved.startsWith(normalizedProject + path.sep) && resolved !== normalizedProject) {
    throw new Error(`Access denied: path "${filePath}" is outside the project directory`)
  }
  return resolved
}

// Skip patterns for file listing
const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', '.nextspark',
  '.turbo', 'dist', '.DS_Store',
])

const ALLOWED_COMMANDS = [
  'pnpm build:registries',
  'pnpm db:migrate',
  'pnpm db:seed',
]

/**
 * Create the Chat MCP server with file manipulation tools.
 */
export function createChatMcpServer(projectDir: string, onEvent?: StudioEventHandler) {
  return createSdkMcpServer({
    name: 'project',
    version: '1.0.0',
    tools: [
      // ── read_file ──────────────────────────────────────────────
      tool(
        'read_file',
        'Read the contents of a file in the project. Use this to understand existing code before making changes.',
        { path: z.string().describe('Relative path from project root, e.g. "contents/themes/my-app/entities/products/products.config.ts"') },
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'read_file', content: `Reading ${args.path}` })
          try {
            const fullPath = assertWithinProject(args.path, projectDir)
            if (!existsSync(fullPath)) {
              return { content: [{ type: 'text' as const, text: `Error: File not found: ${args.path}` }] }
            }
            const stats = await stat(fullPath)
            if (stats.size > 500_000) {
              return { content: [{ type: 'text' as const, text: `Error: File too large (${(stats.size / 1024).toFixed(0)}KB). Maximum 500KB.` }] }
            }
            const content = await readFile(fullPath, 'utf-8')
            onEvent?.({ type: 'tool_result', toolName: 'read_file', content: `Read ${args.path} (${content.length} chars)` })
            return { content: [{ type: 'text' as const, text: content }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Error reading file: ${msg}` }] }
          }
        }
      ),

      // ── write_file ─────────────────────────────────────────────
      tool(
        'write_file',
        'Write content to a file in the project. Creates the file if it doesn\'t exist, or overwrites if it does. Use this to modify configs, entity definitions, pages, components, etc.',
        {
          path: z.string().describe('Relative path from project root'),
          content: z.string().describe('Complete file content to write'),
        },
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'write_file', content: `Writing ${args.path}` })
          try {
            const fullPath = assertWithinProject(args.path, projectDir)
            // Ensure parent directory exists
            await mkdir(path.dirname(fullPath), { recursive: true })
            await writeFile(fullPath, args.content, 'utf-8')
            onEvent?.({ type: 'tool_result', toolName: 'write_file', content: `Wrote ${args.path} (${args.content.length} chars)` })
            return { content: [{ type: 'text' as const, text: `Successfully wrote ${args.path}` }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Error writing file: ${msg}` }] }
          }
        }
      ),

      // ── list_files ─────────────────────────────────────────────
      tool(
        'list_files',
        'List files and directories in a project directory. Useful for understanding project structure before making changes.',
        {
          directory: z.string().default('.').describe('Relative directory path from project root. Use "." for root.'),
          depth: z.number().default(2).describe('How many levels deep to list (1-3)'),
        },
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'list_files', content: `Listing ${args.directory}` })
          try {
            const fullPath = assertWithinProject(args.directory, projectDir)
            if (!existsSync(fullPath)) {
              return { content: [{ type: 'text' as const, text: `Error: Directory not found: ${args.directory}` }] }
            }

            const maxDepth = Math.min(Math.max(args.depth, 1), 3)
            const lines: string[] = []

            async function listDir(dir: string, prefix: string, currentDepth: number) {
              if (currentDepth > maxDepth) return
              const entries = await readdir(dir, { withFileTypes: true })
              const sorted = entries
                .filter(e => !SKIP_DIRS.has(e.name) && !e.name.startsWith('.'))
                .sort((a, b) => {
                  if (a.isDirectory() && !b.isDirectory()) return -1
                  if (!a.isDirectory() && b.isDirectory()) return 1
                  return a.name.localeCompare(b.name)
                })

              for (const entry of sorted) {
                if (entry.isDirectory()) {
                  lines.push(`${prefix}${entry.name}/`)
                  await listDir(path.join(dir, entry.name), prefix + '  ', currentDepth + 1)
                } else {
                  lines.push(`${prefix}${entry.name}`)
                }
              }
            }

            await listDir(fullPath, '', 1)
            const result = lines.join('\n') || '(empty directory)'
            onEvent?.({ type: 'tool_result', toolName: 'list_files', content: `Listed ${lines.length} items in ${args.directory}` })
            return { content: [{ type: 'text' as const, text: result }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Error listing files: ${msg}` }] }
          }
        }
      ),

      // ── search_files ───────────────────────────────────────────
      tool(
        'search_files',
        'Search for text patterns in project files. Returns matching lines with file paths. Useful for finding where something is defined before modifying it.',
        {
          pattern: z.string().describe('Text or regex pattern to search for'),
          directory: z.string().default('.').describe('Directory to search in (relative to project root)'),
          filePattern: z.string().default('*.ts,*.tsx,*.json,*.css,*.mjs').describe('Comma-separated file extensions to search'),
        },
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'search_files', content: `Searching for "${args.pattern}"` })
          try {
            const fullPath = assertWithinProject(args.directory, projectDir)
            if (!existsSync(fullPath)) {
              return { content: [{ type: 'text' as const, text: `Error: Directory not found: ${args.directory}` }] }
            }

            const results: string[] = []
            const extensions = args.filePattern.split(',').map(e => e.trim().replace('*', ''))

            async function searchDir(dir: string) {
              if (results.length >= 50) return // Cap results
              const entries = await readdir(dir, { withFileTypes: true })
              for (const entry of entries) {
                if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
                const entryPath = path.join(dir, entry.name)
                if (entry.isDirectory()) {
                  await searchDir(entryPath)
                } else if (extensions.some(ext => entry.name.endsWith(ext))) {
                  try {
                    const content = await readFile(entryPath, 'utf-8')
                    const lines = content.split('\n')
                    for (let i = 0; i < lines.length; i++) {
                      if (lines[i].includes(args.pattern)) {
                        const relPath = path.relative(projectDir, entryPath).replace(/\\/g, '/')
                        results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`)
                        if (results.length >= 50) return
                      }
                    }
                  } catch {
                    // Skip unreadable files
                  }
                }
              }
            }

            await searchDir(fullPath)
            const output = results.length > 0
              ? results.join('\n')
              : `No matches found for "${args.pattern}"`
            onEvent?.({ type: 'tool_result', toolName: 'search_files', content: `Found ${results.length} matches` })
            return { content: [{ type: 'text' as const, text: output }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Error searching: ${msg}` }] }
          }
        }
      ),

      // ── run_command ────────────────────────────────────────────
      tool(
        'run_command',
        `Run a pre-approved command in the project directory. Only these commands are allowed: ${ALLOWED_COMMANDS.join(', ')}. Use "pnpm build:registries" after modifying entity configs to rebuild auto-generated registries.`,
        {
          command: z.enum(ALLOWED_COMMANDS as [string, ...string[]]).describe('The command to run'),
        },
        async (args) => {
          onEvent?.({ type: 'tool_start', toolName: 'run_command', content: `Running ${args.command}` })
          try {
            const output = execSync(args.command, {
              cwd: projectDir,
              timeout: 60_000,
              encoding: 'utf-8',
              env: {
                ...process.env,
                FORCE_COLOR: '0',
                NEXTSPARK_PROJECT_ROOT: projectDir,
              },
            })
            onEvent?.({ type: 'tool_result', toolName: 'run_command', content: `Command completed: ${args.command}` })
            return { content: [{ type: 'text' as const, text: output || 'Command completed successfully' }] }
          } catch (err) {
            const msg = err instanceof Error ? (err as Error & { stdout?: string; stderr?: string }).stderr || err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Command failed: ${msg}` }] }
          }
        }
      ),
    ],
  })
}

/**
 * MCP tool names for the chat server.
 */
export const CHAT_MCP_TOOL_NAMES = [
  'mcp__project__read_file',
  'mcp__project__write_file',
  'mcp__project__list_files',
  'mcp__project__search_files',
  'mcp__project__run_command',
] as const
