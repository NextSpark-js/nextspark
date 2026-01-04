/**
 * Documentation Commands for Cypress
 *
 * Custom commands for generating documentation videos with narration.
 * Uses cypress-slow-down for controlled execution speed.
 *
 * @example
 * // In your test file:
 * import '../support/doc-commands'
 *
 * describe('Tutorial: Login', { tags: ['@doc'] }, () => {
 *   before(() => {
 *     cy.startDocMode(800)
 *   })
 *
 *   it('shows how to login', () => {
 *     cy.narrate('First, navigate to the login page')
 *     cy.visit('/login')
 *   })
 * })
 */

import { slowCypressDown } from 'cypress-slow-down'
import 'cypress-slow-down/commands'

// Store narrations for extraction
interface NarrationEntry {
  timestamp: number
  time: string        // "M:SS" format from start (for subtitles)
  timeMs: number      // Milliseconds from start
  stepNumber: number
  text: string
  highlight?: string
  duration: number
  chapter?: string
}

let narrations: NarrationEntry[] = []
let stepCounter = 0
let docModeActive = false
let startTime = 0     // Timestamp when recording started

/**
 * Format milliseconds to M:SS or MM:SS string
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Declare custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Start documentation mode with specified delay between commands
       * @param delayMs - Milliseconds to wait between each command (default: 800)
       */
      startDocMode(delayMs?: number): Chainable<void>

      /**
       * End documentation mode and save narrations
       */
      endDocMode(): Chainable<void>

      /**
       * Add narration text for the current step
       * @param text - The narration text to display/speak
       * @param options - Optional settings like highlight selector
       */
      narrate(text: string, options?: { highlight?: string; pause?: number }): Chainable<void>

      /**
       * Add a chapter/section marker in the narration
       * @param title - Chapter title
       */
      chapter(title: string): Chainable<void>

      /**
       * Pause for emphasis (used after important actions)
       * @param ms - Milliseconds to pause
       */
      pauseForEmphasis(ms?: number): Chainable<void>

      /**
       * Highlight an element visually (adds temporary outline)
       * @param selector - Element selector to highlight
       */
      highlightElement(selector: string): Chainable<void>
    }
  }
}

/**
 * Calculate reading time based on text length
 * Average reading speed: ~150-180 words per minute for narration
 * We use ~4 characters = 1 syllable, ~1.5 syllables/second for clear speech
 */
function calculateNarrationDuration(text: string): number {
  const words = text.split(/\s+/).length
  const wordsPerSecond = 2.5 // Slow, clear narration speed
  const baseTime = (words / wordsPerSecond) * 1000
  // Add minimum time and buffer
  return Math.max(1500, baseTime + 500)
}

/**
 * Start documentation mode - slows down Cypress execution
 */
Cypress.Commands.add('startDocMode', (delayMs = 800) => {
  docModeActive = true
  narrations = []
  stepCounter = 0
  startTime = Date.now()  // Record start time

  // Activate slow mode
  slowCypressDown(delayMs)

  // Log start marker (visible in video)
  cy.log('**DOCUMENTATION MODE STARTED**')

  // Add initial narration entry
  narrations.push({
    timestamp: startTime,
    time: '0:00',
    timeMs: 0,
    stepNumber: 0,
    text: '--- Documentation Recording Started ---',
    duration: 0,
  })
})

/**
 * End documentation mode and save narrations to file
 */
Cypress.Commands.add('endDocMode', () => {
  if (!docModeActive) return

  cy.log('**DOCUMENTATION MODE ENDED**')

  // Add final narration entry
  const now = Date.now()
  const elapsedMs = now - startTime
  narrations.push({
    timestamp: now,
    time: formatTime(elapsedMs),
    timeMs: elapsedMs,
    stepNumber: stepCounter + 1,
    text: '--- Documentation Recording Ended ---',
    duration: 0,
  })

  // Save narrations to file via task
  const specName = Cypress.spec.name.replace('.cy.ts', '').replace('.cy.js', '')
  cy.task('saveNarrations', {
    specName,
    narrations,
    totalDuration: formatTime(elapsedMs),
    totalDurationMs: elapsedMs,
  }, { log: false })

  cy.log(`**Total Duration: ${formatTime(elapsedMs)}**`)

  docModeActive = false
  narrations = []
  stepCounter = 0
  startTime = 0
})

/**
 * Add narration for current step
 */
Cypress.Commands.add('narrate', (text: string, options?: { highlight?: string; pause?: number }) => {
  stepCounter++
  const duration = calculateNarrationDuration(text)
  const now = Date.now()
  const elapsedMs = now - startTime
  const timeStr = formatTime(elapsedMs)

  // Store narration data
  narrations.push({
    timestamp: now,
    time: timeStr,
    timeMs: elapsedMs,
    stepNumber: stepCounter,
    text,
    highlight: options?.highlight,
    duration,
  })

  // Visual feedback in Cypress runner (will show in video)
  cy.log(`**[${timeStr}]** ${text}`)

  // If highlight specified, add visual indicator
  if (options?.highlight) {
    cy.highlightElement(options.highlight)
  }

  // Wait for narration duration (so video has time for the narration)
  const waitTime = options?.pause ?? duration
  cy.wait(waitTime, { log: false })
})

/**
 * Add chapter marker
 */
Cypress.Commands.add('chapter', (title: string) => {
  stepCounter++
  const now = Date.now()
  const elapsedMs = now - startTime
  const timeStr = formatTime(elapsedMs)

  narrations.push({
    timestamp: now,
    time: timeStr,
    timeMs: elapsedMs,
    stepNumber: stepCounter,
    text: `=== ${title} ===`,
    chapter: title,
    duration: 2000,
  })

  // Large visual marker
  cy.log(`**[${timeStr}] === ${title.toUpperCase()} ===**`)
  cy.wait(2000, { log: false })
})

/**
 * Pause for emphasis after important actions
 */
Cypress.Commands.add('pauseForEmphasis', (ms = 1500) => {
  cy.log('*pause*')
  cy.wait(ms, { log: false })
})

/**
 * Highlight an element with a visual indicator
 */
Cypress.Commands.add('highlightElement', (selector: string) => {
  cy.get(selector).then($el => {
    // Add highlight class
    $el.css({
      outline: '3px solid #ff6b6b',
      outlineOffset: '2px',
      transition: 'outline 0.3s ease',
    })

    // Remove highlight after a delay
    cy.wait(800, { log: false }).then(() => {
      $el.css({
        outline: 'none',
        outlineOffset: '0',
      })
    })
  })
})

export {}
