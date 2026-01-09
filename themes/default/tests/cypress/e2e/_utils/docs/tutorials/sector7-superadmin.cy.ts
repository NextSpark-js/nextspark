/// <reference types="cypress" />

/**
 * Sector 7 - SuperAdmin Teams View - Documentation Video
 *
 * This test generates a documentation video showing how a superadmin
 * can access Sector 7 and view all teams in the system.
 *
 * Run: NEXT_PUBLIC_ACTIVE_THEME=default pnpm cy:run --spec "sector7-superadmin-teams.doc.cy.ts"
 *
 * Output:
 * - Video: cypress/videos/docs/tutorials/superadmin-superadmin-teams.doc.cy.ts.mp4
 * - Narrations: cypress/docs-output/narrations/superadmin-superadmin-teams.doc-narrations.json
 *
 * @tags @doc, @tutorial, @sector7, @superadmin
 */

// Import slow-down plugin
import { slowCypressDown } from 'cypress-slow-down'
import 'cypress-slow-down/commands'

// Import POMs
import { LoginForm } from '../../../../../../../../test/cypress/src/classes/components/auth/LoginForm.js'
import { TopNavbar } from '../../../../../../../../test/cypress/src/classes/components/navigation/TopNavbar.js'
import { SuperadminNavigation } from '../../../../../../../../test/cypress/src/classes/superadmin/SuperadminNavigation.js'
import { TeamsTable } from '../../../../../../../../test/cypress/src/classes/superadmin/TeamsTable.js'
import { Session } from '../../../../../../../../test/cypress/src/classes/shared'

// ============================================
// Configuration
// ============================================

const CONFIG = {
  // Speed control (ms between commands) - FAST for ~1:30 video
  commandDelay: 200,

  // Narration timing (ms) - Optimized for short video
  narration: {
    short: 1000,    // ~8 words
    medium: 1500,   // ~12-15 words
    long: 2000,     // ~20 words
    chapter: 1000,  // Chapter title display
    pause: 400,     // Pause for emphasis
  },

  // SuperAdmin credentials (from sample data)
  superadmin: {
    email: 'superadmin@nextspark.dev',
    password: 'Pandora1234',
  },
}

// ============================================
// Narration Helpers
// ============================================

interface NarrationEntry {
  timestamp: number
  step: number
  text: string
  chapter?: string
  duration: number
}

let narrations: NarrationEntry[] = []
let stepCounter = 0

/**
 * Log narration and wait for reading time
 */
function narrate(text: string, durationMs: number = CONFIG.narration.medium) {
  stepCounter++
  const entry: NarrationEntry = {
    timestamp: Date.now(),
    step: stepCounter,
    text,
    duration: durationMs,
  }
  narrations.push(entry)

  // Visual log (appears in video)
  cy.log(`🎙️ **[${stepCounter}]** ${text}`)

  // Wait for narration duration
  cy.wait(durationMs, { log: false })
}

/**
 * Add chapter marker
 */
function chapter(title: string) {
  stepCounter++
  narrations.push({
    timestamp: Date.now(),
    step: stepCounter,
    text: `=== ${title} ===`,
    chapter: title,
    duration: CONFIG.narration.chapter,
  })

  cy.log(`📖 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  cy.log(`📖 **${title.toUpperCase()}**`)
  cy.log(`📖 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  cy.wait(CONFIG.narration.chapter, { log: false })
}

/**
 * Pause for emphasis
 */
function pause(ms: number = CONFIG.narration.pause) {
  cy.wait(ms, { log: false })
}

/**
 * Highlight element with visual indicator
 */
function highlight(selector: string, duration: number = 1200) {
  cy.get(selector).then($el => {
    $el.css({
      outline: '4px solid #ef4444',
      outlineOffset: '4px',
      boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)',
      transition: 'all 0.3s ease',
    })
  })

  cy.wait(duration, { log: false })

  cy.get(selector).then($el => {
    $el.css({
      outline: 'none',
      outlineOffset: '0',
      boxShadow: 'none',
    })
  })
}

// ============================================
// Documentation Test
// ============================================

describe('Tutorial: Sector 7 - SuperAdmin Teams View', {
  tags: ['@doc', '@tutorial', '@sector7', '@superadmin'],
  retries: 0,  // No retries for documentation videos
}, () => {
  const loginForm = new LoginForm()
  const topNavbar = new TopNavbar()
  const sector7Nav = new SuperadminNavigation()
  const teamsTable = new TeamsTable()

  before(() => {
    // Enable slow mode for documentation
    slowCypressDown(CONFIG.commandDelay)

    cy.log('🎬 ═══════════════════════════════════════')
    cy.log('🎬 **DOCUMENTATION VIDEO RECORDING**')
    cy.log('🎬 Sector 7 - SuperAdmin Teams View')
    cy.log('🎬 ═══════════════════════════════════════')
  })

  beforeEach(() => {
    // Reset narrations before each test/retry
    narrations = []
    stepCounter = 0

    // Setup real authentication test
    Session.setupRealAuthenticationTest()
  })

  after(() => {
    // Save narrations to file
    const specName = 'sector7-superadmin-teams.doc'
    cy.task('saveNarrations', { specName, narrations })

    cy.log('🎬 ═══════════════════════════════════════')
    cy.log('🎬 **RECORDING COMPLETE**')
    cy.log('🎬 ═══════════════════════════════════════')
  })

  // ============================================
  // Single test that captures the entire tutorial
  // ============================================

  it('demuestra cómo un superadmin accede a Sector 7 para ver todos los teams', () => {
    // ─────────────────────────────────────────
    // CHAPTER 1: Introducción
    // ─────────────────────────────────────────
    chapter('Introducción')

    narrate(
      'Bienvenido a Sector 7, el área exclusiva para super administradores.',
      CONFIG.narration.medium
    )

    narrate(
      'Hoy veremos cómo acceder y visualizar todos los equipos del sistema.',
      CONFIG.narration.medium
    )

    // ─────────────────────────────────────────
    // CHAPTER 2: Login como SuperAdmin
    // ─────────────────────────────────────────
    chapter('Login como SuperAdmin')

    // Navigate to login
    cy.visit('/login')
    cy.wait(1500, { log: false })

    narrate(
      'Iniciamos sesión con las credenciales de superadmin.',
      CONFIG.narration.short
    )

    // Click to show email form, wait for form to appear
    cy.get('[data-cy="login-show-email"]').should('be.visible').click()
    cy.wait(500, { log: false })

    // Wait for form inputs to be visible (separate chain to avoid detachment issues)
    cy.get('[data-cy="login-email-input"]', { timeout: 10000 }).should('be.visible')
    cy.get('[data-cy="login-password-input"]', { timeout: 10000 }).should('be.visible')
    pause(500)

    narrate(
      'Usamos el email del superadmin de prueba.',
      CONFIG.narration.short
    )

    // Fill email (separate get to avoid detachment)
    cy.get('[data-cy="login-email-input"]').clear().type(CONFIG.superadmin.email)
    pause(300)

    narrate(
      'Ingresamos la contraseña y enviamos.',
      CONFIG.narration.short
    )

    // Fill password (separate get)
    cy.get('[data-cy="login-password-input"]').clear().type(CONFIG.superadmin.password, { log: false })
    pause(200)

    // Submit (separate get)
    cy.get('[data-cy="login-submit"]').click()

    // Wait for dashboard
    cy.url().should('include', '/dashboard', { timeout: 15000 })
    pause(500)

    narrate(
      'Acceso concedido. Observa el icono de Sector 7 en la barra superior.',
      CONFIG.narration.medium
    )

    // Highlight Sector 7 icon
    highlight('[data-cy="topnav-superadmin"]', 1200)

    // ─────────────────────────────────────────
    // CHAPTER 3: Navegación a Sector 7
    // ─────────────────────────────────────────
    chapter('Navegación a Sector 7')

    narrate(
      'Hacemos clic para ingresar al área restringida.',
      CONFIG.narration.short
    )

    // Navigate to Sector 7
    topNavbar.navigateToSuperadmin()

    // Wait for Sector 7 page
    cy.url().should('include', '/superadmin')
    cy.contains('Super Administrator Control Panel').should('be.visible')
    pause(500)

    narrate(
      'Este es el panel de control del super administrador.',
      CONFIG.narration.medium
    )

    pause(300)

    narrate(
      'En el menú lateral vemos las opciones disponibles.',
      CONFIG.narration.short
    )

    // Highlight Teams nav option
    highlight('[data-cy="superadmin-nav-teams"]', 1000)

    // ─────────────────────────────────────────
    // CHAPTER 4: Visualización de Teams
    // ─────────────────────────────────────────
    chapter('Visualización de Teams')

    narrate(
      'Navegamos a la sección de Equipos.',
      CONFIG.narration.short
    )

    // Navigate to Teams
    sector7Nav.navigateToTeams()

    // Wait for teams page
    cy.url().should('include', '/superadmin/teams')
    cy.contains('Team Management').should('be.visible')
    pause(500)

    narrate(
      'Aquí vemos todos los equipos del sistema con estadísticas.',
      CONFIG.narration.medium
    )

    // Highlight stats card
    cy.get('.text-2xl.font-bold').first().then($el => {
      $el.css({
        outline: '4px solid #22c55e',
        outlineOffset: '4px',
        boxShadow: '0 0 15px rgba(34, 197, 94, 0.4)',
      })
    })
    pause(1000)
    cy.get('.text-2xl.font-bold').first().then($el => {
      $el.css({ outline: 'none', boxShadow: 'none' })
    })

    narrate(
      'La pestaña Work Teams muestra equipos colaborativos.',
      CONFIG.narration.medium
    )

    // Highlight Work Teams tab (use button with role="tab")
    cy.contains('button[role="tab"]', 'Work Teams').then($el => {
      $el.css({
        outline: '3px solid #3b82f6',
        outlineOffset: '2px',
      })
    })
    pause(800)
    cy.contains('button[role="tab"]', 'Work Teams').then($el => {
      $el.css({ outline: 'none' })
    })

    // Wait for table to load
    cy.get('table').should('be.visible')
    pause(500)

    narrate(
      'También podemos ver los equipos personales de cada usuario.',
      CONFIG.narration.medium
    )

    // Switch to Personal tab
    cy.contains('button[role="tab"]', 'Personal').click()
    pause(800)

    // Wait for table to update
    cy.get('table').should('be.visible')
    pause(500)

    narrate(
      'El buscador permite filtrar equipos por nombre o email del propietario.',
      CONFIG.narration.medium
    )

    // Highlight search input
    highlight('[data-cy="teams-search-input"]', 1000)

    // ─────────────────────────────────────────
    // CHAPTER 5: Conclusión
    // ─────────────────────────────────────────
    chapter('Conclusión')

    narrate(
      'Así funciona Sector 7: acceso exclusivo a la gestión global del sistema.',
      CONFIG.narration.medium
    )

    pause(500)

    narrate(
      'Gracias por ver este tutorial.',
      CONFIG.narration.short
    )

    cy.log('🎬 ═══════════════════════════════════════')
    cy.log('🎬 **¡Gracias por ver este tutorial!**')
    cy.log('🎬 ═══════════════════════════════════════')

    pause(800)
  })
})
