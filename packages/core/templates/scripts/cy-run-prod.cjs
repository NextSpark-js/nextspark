#!/usr/bin/env node
/**
 * Cypress Production Runner
 *
 * Runs Cypress tests against a production build instead of dev server.
 * This is more stable for heavy test runs since there's no webpack compilation overhead.
 *
 * Usage:
 *   pnpm cy:run:prod                    # Run all tests against production build
 *   pnpm cy:run:prod --spec "**\/tasks*.cy.ts"  # Run specific spec
 *   pnpm cy:run:prod --headed           # Run with browser visible
 *   pnpm cy:run:prod --env grepTags=@smoke  # Run smoke tests
 *
 * What this script does:
 *   1. Kills any process on port 3000
 *   2. Runs `pnpm build` to create production build
 *   3. Starts `pnpm start` in background
 *   4. Waits for server to be healthy (GET /)
 *   5. Runs Cypress with passed arguments
 *   6. Cleans up server process
 *   7. Returns Cypress exit code
 */

const { spawn, spawnSync, execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const http = require('http')

// Configuration
const PORT = 3000
const HEALTH_CHECK_URL = `http://localhost:${PORT}/`
const HEALTH_CHECK_TIMEOUT = 60000 // 60 seconds max wait for server
const HEALTH_CHECK_INTERVAL = 1000 // Check every 1 second

// Get arguments after script name
const args = process.argv.slice(2)

// Find the active theme's cypress config
function findCypressConfig() {
  const contentsDir = path.join(process.cwd(), 'contents', 'themes')

  if (!fs.existsSync(contentsDir)) {
    console.error('Error: contents/themes directory not found')
    process.exit(1)
  }

  const themes = fs.readdirSync(contentsDir).filter((name) => {
    const themePath = path.join(contentsDir, name)
    return fs.statSync(themePath).isDirectory()
  })

  // Check NEXT_PUBLIC_ACTIVE_THEME env var first
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME

  if (activeTheme && themes.includes(activeTheme)) {
    const configPath = path.join(contentsDir, activeTheme, 'tests', 'cypress.config.ts')
    if (fs.existsSync(configPath)) {
      return configPath
    }
  }

  // Otherwise use the first theme found
  for (const theme of themes) {
    const configPath = path.join(contentsDir, theme, 'tests', 'cypress.config.ts')
    if (fs.existsSync(configPath)) {
      return configPath
    }
  }

  console.error('Error: No cypress.config.ts found in any theme')
  process.exit(1)
}

// Kill process on port
function killPort(port) {
  console.log(`\n[cy:run:prod] Killing any process on port ${port}...`)
  try {
    if (process.platform === 'win32') {
      execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' })
        .split('\n')
        .forEach((line) => {
          const pid = line.trim().split(/\s+/).pop()
          if (pid && /^\d+$/.test(pid)) {
            try {
              execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
            } catch (e) {
              // Process might already be dead
            }
          }
        })
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' })
    }
    console.log(`[cy:run:prod] Port ${port} cleared`)
  } catch (e) {
    // No process on port, that's fine
    console.log(`[cy:run:prod] Port ${port} was already free`)
  }
}

// Run production build
function runBuild() {
  console.log('\n[cy:run:prod] Building production bundle...')
  const result = spawnSync('pnpm', ['build'], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  })

  if (result.status !== 0) {
    console.error('[cy:run:prod] Build failed!')
    process.exit(result.status || 1)
  }
  console.log('[cy:run:prod] Build completed successfully')
}

// Start production server
function startServer() {
  console.log('\n[cy:run:prod] Starting production server...')
  const server = spawn('pnpm', ['start'], {
    stdio: 'pipe',
    shell: true,
    cwd: process.cwd(),
    detached: false,
  })

  server.stdout.on('data', (data) => {
    const output = data.toString()
    // Only log important messages, not every line
    if (output.includes('Ready') || output.includes('started') || output.includes('Error')) {
      console.log(`[server] ${output.trim()}`)
    }
  })

  server.stderr.on('data', (data) => {
    console.error(`[server:err] ${data.toString().trim()}`)
  })

  return server
}

// Health check - wait for server to respond
function waitForServer() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()

    const check = () => {
      const elapsed = Date.now() - startTime
      if (elapsed > HEALTH_CHECK_TIMEOUT) {
        reject(new Error(`Server did not start within ${HEALTH_CHECK_TIMEOUT / 1000}s`))
        return
      }

      const req = http.get(HEALTH_CHECK_URL, (res) => {
        // Any response means server is up (even 3xx redirects)
        if (res.statusCode >= 200 && res.statusCode < 500) {
          console.log(`[cy:run:prod] Server is ready (status: ${res.statusCode})`)
          resolve()
        } else {
          setTimeout(check, HEALTH_CHECK_INTERVAL)
        }
      })

      req.on('error', () => {
        // Server not ready yet
        process.stdout.write('.')
        setTimeout(check, HEALTH_CHECK_INTERVAL)
      })

      req.setTimeout(2000, () => {
        req.destroy()
        setTimeout(check, HEALTH_CHECK_INTERVAL)
      })
    }

    console.log('[cy:run:prod] Waiting for server to be ready...')
    check()
  })
}

// Run Cypress tests
function runCypress(configFile) {
  const cypressArgs = ['cypress', 'run', '--config-file', configFile, ...args]

  console.log(`\n[cy:run:prod] Running: npx ${cypressArgs.join(' ')}`)

  const result = spawnSync('npx', cypressArgs, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  })

  return result.status || 0
}

// Cleanup function
function cleanup(server) {
  console.log('\n[cy:run:prod] Cleaning up...')

  if (server) {
    try {
      // Kill the server process tree
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' })
      } else {
        // Kill process group
        try {
          process.kill(-server.pid, 'SIGKILL')
        } catch (e) {
          // If process group kill fails, try direct kill
          try {
            server.kill('SIGKILL')
          } catch (e2) {
            // Process might already be dead
          }
        }
      }
    } catch (e) {
      // Process might already be dead
    }
  }

  // Double-check port is free
  killPort(PORT)
  console.log('[cy:run:prod] Cleanup complete')
}

// Main execution
async function main() {
  let server = null
  let exitCode = 1

  try {
    // Step 1: Find config
    const configFile = findCypressConfig()
    console.log(`[cy:run:prod] Using config: ${configFile}`)

    // Step 2: Kill port
    killPort(PORT)

    // Step 3: Build
    runBuild()

    // Step 4: Start server
    server = startServer()

    // Step 5: Wait for server
    await waitForServer()

    // Step 6: Run Cypress
    exitCode = runCypress(configFile)
  } catch (error) {
    console.error(`\n[cy:run:prod] Error: ${error.message}`)
    exitCode = 1
  } finally {
    // Step 7: Cleanup
    cleanup(server)
  }

  process.exit(exitCode)
}

// Handle signals
process.on('SIGINT', () => {
  console.log('\n[cy:run:prod] Interrupted, cleaning up...')
  killPort(PORT)
  process.exit(130)
})

process.on('SIGTERM', () => {
  console.log('\n[cy:run:prod] Terminated, cleaning up...')
  killPort(PORT)
  process.exit(143)
})

// Run
main()
