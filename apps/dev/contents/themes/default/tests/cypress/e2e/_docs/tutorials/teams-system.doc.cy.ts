/// <reference types="cypress" />

/**
 * Teams System - Documentation Video
 *
 * This test generates a documentation video showing how the multi-tenant
 * team system works, including team switching and permission differences.
 *
 * Run with: NEXT_PUBLIC_ACTIVE_THEME=default pnpm cy:run --spec "teams-system.doc.cy.ts"
 *
 * Output:
 * - Video: cypress/videos/docs/tutorials/teams-system.doc.cy.ts.mp4
 * - Narrations: cypress/videos/narrations/teams-system.doc-narrations.json
 *
 * @tags @doc, @tutorial, @teams
 */

// Import custom documentation commands (cy.narrate, cy.chapter, etc.)
import '../../../support/doc-commands'

// Import POMs
import { DevKeyring } from '../../../../../../../../test/cypress/src/classes/components/auth/DevKeyring.js'
import { TeamSwitcher } from '../../../../../../../../test/cypress/src/classes/components/teams/TeamSwitcher.js'

// ============================================
// Configuration
// ============================================

const CONFIG = {
  // Speed control (ms between commands) - for ~2min video
  commandDelay: 250,

  // Narration timing (ms)
  narration: {
    short: 1200,    // ~10 words
    medium: 1800,   // ~15-20 words
    long: 2400,     // ~25+ words
  },

  // Test users
  users: {
    CARLOS: 'carlos.mendoza@nextspark.dev',
  },

  // Team slugs
  teams: {
    EVERPOINT: 'everpoint-labs',
    RIVERSTONE: 'riverstone-ventures',
  },

  // Spanish role names (app locale)
  roles: {
    OWNER: 'Propietario',
    MEMBER: 'Miembro',
  },
}

// ============================================
// Documentation Test
// ============================================

describe('Tutorial: Sistema de Teams', {
  tags: ['@doc', '@tutorial', '@teams'],
  retries: 0,  // No retries for documentation videos
}, () => {
  let teamSwitcher: TeamSwitcher

  before(() => {
    // Start documentation mode with slow-down
    cy.startDocMode(CONFIG.commandDelay)

    cy.log('🎬 ═══════════════════════════════════════')
    cy.log('🎬 **DOCUMENTATION VIDEO RECORDING**')
    cy.log('🎬 Sistema de Teams - Multi-Tenancy')
    cy.log('🎬 ═══════════════════════════════════════')
  })

  beforeEach(() => {
    teamSwitcher = new TeamSwitcher()
  })

  after(() => {
    // End documentation mode and save narrations
    cy.endDocMode()

    cy.log('🎬 ═══════════════════════════════════════')
    cy.log('🎬 **RECORDING COMPLETE**')
    cy.log('🎬 ═══════════════════════════════════════')
  })

  // ============================================
  // Single test that captures the entire tutorial
  // ============================================

  it('demuestra el sistema completo de equipos y permisos', () => {
    // ─────────────────────────────────────────
    // CHAPTER 1: Introducción
    // ─────────────────────────────────────────
    cy.chapter('Introducción')

    cy.narrate(
      'Bienvenido al tutorial del Sistema de Teams. Hoy aprenderás cómo organizar tu trabajo en diferentes espacios.',
      { pause: CONFIG.narration.long }
    )

    cy.narrate(
      'Carlos es un usuario con acceso a múltiples equipos. Veamos cómo funciona.',
      { pause: CONFIG.narration.medium }
    )

    // Login as Carlos
    cy.visit('/login')
    cy.wait(500, { log: false })

    const devKeyring = new DevKeyring()
    devKeyring.validateVisible()

    cy.narrate(
      'Iniciamos sesión con la cuenta de Carlos usando el selector de credenciales de prueba.',
      { pause: CONFIG.narration.medium }
    )

    devKeyring.quickLoginByEmail(CONFIG.users.CARLOS)
    cy.url().should('include', '/dashboard')
    cy.pauseForEmphasis(500)

    // ─────────────────────────────────────────
    // CHAPTER 2: El Selector de Equipos
    // ─────────────────────────────────────────
    cy.chapter('El Selector de Equipos')

    cy.narrate(
      'En el panel lateral izquierdo encontramos el selector de equipos.',
      { pause: CONFIG.narration.medium }
    )

    // Ensure sidebar is expanded
    teamSwitcher.ensureSidebarExpanded()
    cy.pauseForEmphasis(300)

    // Highlight the team switcher
    cy.highlightElement('[data-cy="team-switcher-compact"]')

    cy.narrate(
      'Aquí vemos el equipo actual: Everpoint Labs, donde Carlos es propietario.',
      { pause: CONFIG.narration.medium }
    )

    // Validate current team
    teamSwitcher.validateCurrentTeamName('Everpoint Labs')
    cy.pauseForEmphasis(300)

    cy.narrate(
      'Al hacer clic, se despliega una lista con todos los equipos disponibles.',
      { pause: CONFIG.narration.medium }
    )

    // Open dropdown
    teamSwitcher.open()
    cy.pauseForEmphasis(700)

    cy.narrate(
      'Observa que cada equipo muestra el rol del usuario. Carlos es Propietario aquí.',
      { pause: CONFIG.narration.long }
    )

    // Highlight Everpoint role
    cy.get(`[data-cy="team-option-${CONFIG.teams.EVERPOINT}"]`).then($el => {
      $el.css({
        outline: '3px solid #22c55e',
        outlineOffset: '2px',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
      })
    })
    cy.pauseForEmphasis(1000)

    cy.narrate(
      'También tiene acceso a Riverstone Ventures, pero aquí es solo Miembro.',
      { pause: CONFIG.narration.medium }
    )

    // Reset Everpoint, highlight Riverstone
    cy.get(`[data-cy="team-option-${CONFIG.teams.EVERPOINT}"]`).then($el => {
      $el.css({
        outline: 'none',
        backgroundColor: 'transparent',
      })
    })

    cy.get(`[data-cy="team-option-${CONFIG.teams.RIVERSTONE}"]`).then($el => {
      $el.css({
        outline: '3px solid #f59e0b',
        outlineOffset: '2px',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
      })
    })
    cy.pauseForEmphasis(1000)

    // Close dropdown
    cy.get('body').type('{esc}')
    cy.pauseForEmphasis(300)

    // ─────────────────────────────────────────
    // CHAPTER 3: Cambiar de Equipo
    // ─────────────────────────────────────────
    cy.chapter('Cambiar de Equipo')

    cy.narrate(
      'Vamos a cambiar al equipo Riverstone Ventures para ver cómo cambia el contexto.',
      { pause: CONFIG.narration.medium }
    )

    // Start team switch
    teamSwitcher.open()
    cy.get(`[data-cy="team-option-${CONFIG.teams.RIVERSTONE}"]`).click()

    cy.narrate(
      'El sistema está cargando los datos del nuevo equipo.',
      { pause: CONFIG.narration.medium }
    )

    // Wait for page to stabilize after team switch
    cy.url().should('include', '/dashboard')
    cy.pauseForEmphasis(1000)

    cy.narrate(
      'Perfecto. Ahora estamos en Riverstone Ventures. Observa el cambio en el selector.',
      { pause: CONFIG.narration.medium }
    )

    // Highlight the changed team name
    cy.highlightElement('[data-cy="team-switcher-compact"]')

    teamSwitcher.validateCurrentTeamName('Riverstone Ventures')

    // ─────────────────────────────────────────
    // CHAPTER 4: Datos Separados por Equipo
    // ─────────────────────────────────────────
    cy.chapter('Datos Separados por Equipo')

    cy.narrate(
      'Cada equipo tiene sus propios datos completamente aislados.',
      { pause: CONFIG.narration.medium }
    )

    cy.narrate(
      'Vamos a la sección de Clientes para comprobarlo.',
      { pause: CONFIG.narration.short }
    )

    // Navigate to customers
    cy.visit('/dashboard/customers')
    cy.get('[data-cy="customers-list"]', { timeout: 15000 }).should('exist')
    cy.pauseForEmphasis(700)

    cy.narrate(
      'Estos son los clientes de Riverstone Ventures. Son independientes de los de Everpoint Labs.',
      { pause: CONFIG.narration.long }
    )

    cy.highlightElement('[data-cy="customers-list"]')

    // ─────────────────────────────────────────
    // CHAPTER 5: Permisos por Equipo
    // ─────────────────────────────────────────
    cy.chapter('Permisos por Equipo')

    cy.narrate(
      'Ahora viene lo interesante: los permisos cambian según tu rol en cada equipo.',
      { pause: CONFIG.narration.long }
    )

    cy.narrate(
      'Como Carlos es Miembro aquí, tiene acceso limitado. Observa la interfaz.',
      { pause: CONFIG.narration.medium }
    )

    cy.pauseForEmphasis(700)

    cy.narrate(
      'No hay botón para crear nuevos clientes. Los miembros solo pueden ver los datos.',
      { pause: CONFIG.narration.long }
    )

    // Verify no create button and highlight the area where it would be
    cy.get('[data-cy="customers-add"]').should('not.exist')

    // Highlight header area
    cy.get('[data-cy="customers-list"]').parent().then($parent => {
      $parent.css({
        outline: '3px dashed #ef4444',
        outlineOffset: '4px',
      })
    })
    cy.pauseForEmphasis(1200)

    cy.get('[data-cy="customers-list"]').parent().then($parent => {
      $parent.css({ outline: 'none' })
    })

    cy.narrate(
      'Volvamos a Everpoint Labs donde Carlos es Propietario.',
      { pause: CONFIG.narration.medium }
    )

    // Switch back to Everpoint
    teamSwitcher.open()
    cy.get(`[data-cy="team-option-${CONFIG.teams.EVERPOINT}"]`).click()
    cy.url().should('include', '/dashboard')
    cy.pauseForEmphasis(1000)

    // Navigate to customers
    cy.visit('/dashboard/customers')
    cy.get('[data-cy="customers-list"]', { timeout: 15000 }).should('exist')
    cy.pauseForEmphasis(500)

    cy.narrate(
      'Aquí sí aparece el botón de crear cliente. Los propietarios tienen control total.',
      { pause: CONFIG.narration.long }
    )

    // Highlight the create button
    cy.get('[data-cy="customers-add"]').should('be.visible')
    cy.highlightElement('[data-cy="customers-add"]')

    // ─────────────────────────────────────────
    // CHAPTER 6: Conclusión
    // ─────────────────────────────────────────
    cy.chapter('Conclusión')

    cy.narrate(
      'Así funciona el sistema de Teams: cada equipo es un espacio aislado con sus propios datos y permisos.',
      { pause: CONFIG.narration.long }
    )

    cy.narrate(
      'Puedes colaborar en múltiples equipos con diferentes roles en cada uno.',
      { pause: CONFIG.narration.medium }
    )

    cy.pauseForEmphasis(500)

    cy.log('🎬 ═══════════════════════════════════════')
    cy.log('🎬 **¡Gracias por ver este tutorial!**')
    cy.log('🎬 ═══════════════════════════════════════')

    cy.pauseForEmphasis(1000)
  })
})
