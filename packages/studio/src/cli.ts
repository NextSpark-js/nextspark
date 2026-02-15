#!/usr/bin/env node
/**
 * NextSpark Studio CLI
 *
 * Interactive CLI for testing the Studio AI orchestrator.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx src/cli.ts "Quiero un CRM para mi gimnasio"
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx src/cli.ts --interactive
 */

import { runStudio } from './ai/orchestrator'
import type { StudioEvent, StudioResult } from './types'

// ANSI colors (no dependency needed)
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
}

function log(color: string, prefix: string, message: string) {
  console.log(`${color}${prefix}${colors.reset} ${message}`)
}

function formatEvent(event: StudioEvent) {
  switch (event.type) {
    case 'text':
      log(colors.cyan, '[Claude]', event.content || '')
      break
    case 'tool_start':
      log(colors.yellow, `[Tool: ${event.toolName}]`, event.content || 'Starting...')
      break
    case 'tool_result':
      log(colors.green, `[Result: ${event.toolName}]`, event.content || '')
      break
    case 'error':
      log(colors.red, '[Error]', event.content || 'Unknown error')
      break
    default:
      log(colors.dim, `[${event.type}]`, event.content || '')
  }
}

function printResult(result: StudioResult) {
  console.log('\n' + colors.bright + '═══════════════════════════════════════════' + colors.reset)
  console.log(colors.bright + '  NEXTSPARK STUDIO - RESULT' + colors.reset)
  console.log(colors.bright + '═══════════════════════════════════════════' + colors.reset)

  if (result.analysis) {
    console.log('\n' + colors.blue + 'ANALYSIS' + colors.reset)
    console.log(`  Preset: ${colors.bright}${result.analysis.preset}${colors.reset} (${(result.analysis.confidence * 100).toFixed(0)}% confidence)`)
    console.log(`  Team Mode: ${result.analysis.suggestedTeamMode}`)
    console.log(`  Billing: ${result.analysis.suggestedBilling}`)
    console.log(`  Features: ${result.analysis.detectedFeatures.join(', ')}`)
    console.log(`  Entities: ${result.analysis.detectedEntities.map(e => e.name).join(', ')}`)
  }

  if (result.wizardConfig) {
    console.log('\n' + colors.blue + 'PROJECT CONFIG' + colors.reset)
    console.log(`  Name: ${colors.bright}${result.wizardConfig.projectName}${colors.reset}`)
    console.log(`  Slug: ${result.wizardConfig.projectSlug}`)
    console.log(`  Type: ${result.wizardConfig.projectType || 'web'}`)
    console.log(`  Team: ${result.wizardConfig.teamMode} (${(result.wizardConfig.teamRoles || []).join(', ')})`)
    console.log(`  Billing: ${result.wizardConfig.billingModel} (${result.wizardConfig.currency || 'usd'})`)
    console.log(`  Auth: ${result.wizardConfig.auth.registrationMode}`)
    console.log(`  Theme: ${result.theme || 'default'}`)
    console.log(`  Plugins: ${result.plugins?.length ? result.plugins.join(', ') : 'none'}`)
    console.log(`  Locale: ${result.wizardConfig.defaultLocale} (${result.wizardConfig.supportedLocales.join(', ')})`)
  }

  if (result.entities && result.entities.length > 0) {
    console.log('\n' + colors.blue + 'ENTITIES' + colors.reset)
    for (const entity of result.entities) {
      console.log(`\n  ${colors.bright}${entity.names.plural}${colors.reset} (${entity.slug})`)
      console.log(`  Access: ${entity.accessMode} | ${entity.description}`)
      console.log('  Fields:')
      for (const field of entity.fields) {
        const req = field.required ? colors.red + '*' + colors.reset : ' '
        const opts = field.options ? ` [${field.options.map(o => o.value).join('|')}]` : ''
        const rel = field.relation ? ` → ${field.relation.entity}` : ''
        console.log(`    ${req} ${field.name}: ${colors.dim}${field.type}${colors.reset}${opts}${rel}`)
      }
    }
  }

  // Print CLI command equivalent
  if (result.wizardConfig) {
    console.log('\n' + colors.blue + 'CLI EQUIVALENT' + colors.reset)
    const cfg = result.wizardConfig
    const cmd = [
      'nextspark init',
      '--yes',
      `--preset ${result.analysis?.preset || 'saas'}`,
      `--name "${cfg.projectName}"`,
      `--slug "${cfg.projectSlug}"`,
      `--description "${cfg.projectDescription}"`,
      `--type ${cfg.projectType}`,
      `--theme ${result.theme || 'default'}`,
    ]
    if (result.plugins && result.plugins.length > 0) {
      cmd.push(`--plugins "${result.plugins.join(',')}"`)
    }
    console.log(`  ${colors.dim}${cmd.join(' \\\n    ')}${colors.reset}`)
  }

  console.log('\n' + colors.bright + '═══════════════════════════════════════════' + colors.reset)
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
${colors.bright}NextSpark Studio CLI${colors.reset}

${colors.dim}Usage:${colors.reset}
  npx tsx src/cli.ts "Describe your app..."
  npx tsx src/cli.ts "Quiero un CRM para mi gimnasio"

${colors.dim}Environment:${colors.reset}
  ANTHROPIC_API_KEY    Required. Your Anthropic API key.
  STUDIO_MODEL         Optional. Override the Claude model (default: claude-sonnet-4-5-20250929).

${colors.dim}Examples:${colors.reset}
  npx tsx src/cli.ts "I want a project management tool for my team"
  npx tsx src/cli.ts "Blog para mi portfolio de fotografia"
  npx tsx src/cli.ts "SaaS for managing gym memberships with clients and payments"
`)
    process.exit(0)
  }

  const prompt = args.join(' ')

  console.log(colors.bright + '\nNextSpark Studio' + colors.reset)
  console.log(colors.dim + '─────────────────────────────────────────' + colors.reset)
  console.log(`${colors.magenta}You:${colors.reset} ${prompt}\n`)

  try {
    const result = await runStudio(prompt, formatEvent)
    printResult(result)

    // Write result to JSON for downstream tools
    const outputPath = './studio-result.json'
    const { writeFileSync } = await import('fs')
    writeFileSync(outputPath, JSON.stringify(result, null, 2))
    console.log(`\n${colors.dim}Result saved to: ${outputPath}${colors.reset}\n`)

  } catch (error) {
    if (error instanceof Error) {
      log(colors.red, '[Fatal]', error.message)
      if (error.message.includes('ANTHROPIC_API_KEY')) {
        console.log(`\n${colors.dim}Set your API key:${colors.reset}`)
        console.log(`  export ANTHROPIC_API_KEY=sk-ant-...`)
      }
    } else {
      log(colors.red, '[Fatal]', String(error))
    }
    process.exit(1)
  }
}

main()
