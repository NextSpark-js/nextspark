# Cypress Documentation Videos

This directory contains Cypress tests designed to generate documentation videos with narration support.

## Concept

Instead of manually recording tutorial videos, we use Cypress tests that:
1. **Slow down execution** to human-readable speed using `cypress-slow-down`
2. **Add narration markers** that are saved as JSON for post-processing
3. **Highlight elements** visually during important steps
4. **Generate MP4 videos** automatically via Cypress video recording

## Quick Start

### Run a documentation test

```bash
# Interactive mode (watch the test execute)
NEXT_PUBLIC_ACTIVE_THEME=default pnpm cy:open

# Headless mode (generates video file)
NEXT_PUBLIC_ACTIVE_THEME=default pnpm cy:run --spec "**/teams-system.doc.cy.ts"
```

### Output Files

After running, you'll find:
- **Video**: `cypress/videos/docs/tutorials/teams-system.doc.cy.ts.mp4`
- **Narrations**: `cypress/docs-output/narrations/teams-system.doc-narrations.json`

## File Structure

```
cypress/e2e/docs/
├── README.md                    # This file
└── tutorials/
    ├── teams-system.doc.cy.ts   # The actual Cypress test
    └── teams-system.narration.json  # Narration script (reference)

cypress/docs-output/
└── narrations/
    └── teams-system.doc-narrations.json  # Generated narration timing
```

## Creating a New Documentation Video

### 1. Plan the narration

Create a `.narration.json` file with your script:

```json
{
  "title": "Feature Name Tutorial",
  "chapters": [
    {
      "id": "intro",
      "title": "Introduction",
      "narrations": [
        {
          "step": 1,
          "text": "Welcome to this tutorial...",
          "action": "none",
          "estimatedSeconds": 5
        }
      ]
    }
  ]
}
```

### 2. Create the test file

Use the `*.doc.cy.ts` naming convention:

```typescript
import { slowCypressDown } from 'cypress-slow-down'
import 'cypress-slow-down/commands'

const CONFIG = {
  commandDelay: 600,  // ms between commands
  narration: {
    short: 2500,
    medium: 4000,
    long: 5500,
  }
}

describe('Tutorial: Feature Name', { tags: ['@doc'] }, () => {
  before(() => {
    slowCypressDown(CONFIG.commandDelay)
  })

  it('demonstrates the feature', () => {
    // Chapter marker
    cy.log('📖 **CHAPTER: Introduction**')
    cy.wait(2000)

    // Narration with wait
    cy.log('🎙️ Welcome to this tutorial about...')
    cy.wait(4000)  // Time for narration

    // Your test actions...
    cy.visit('/some-page')

    // Highlight important elements
    cy.get('[data-cy="important"]').then($el => {
      $el.css({ outline: '4px solid red' })
    })
    cy.wait(2000)  // Let viewer see highlight
  })
})
```

### 3. Run and collect outputs

```bash
# Generate video and narrations
NEXT_PUBLIC_ACTIVE_THEME=default pnpm cy:run --spec "**/your-feature.doc.cy.ts"
```

## Post-Processing Pipeline

The generated outputs can be processed with AI tools:

### Video + Narrations → Final Documentation

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Cypress Video  │    │  Narration JSON │    │   AI Service    │
│  (MP4, no audio)│───►│  (timestamps)   │───►│  (Guidde/HeyGen)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                      │
                                                      ▼
                                              ┌─────────────────┐
                                              │  Final Video    │
                                              │  + AI Narration │
                                              │  + Subtitles    │
                                              └─────────────────┘
```

### Narration JSON Format

The generated `*-narrations.json` contains:

```json
[
  {
    "timestamp": 1702400000000,
    "step": 1,
    "text": "=== Introduction ===",
    "chapter": "Introduction",
    "duration": 2500
  },
  {
    "timestamp": 1702400002500,
    "step": 2,
    "text": "Welcome to this tutorial...",
    "duration": 4000
  }
]
```

This can be used to:
- Generate SRT subtitle files
- Send to text-to-speech APIs (ElevenLabs, Google TTS)
- Sync audio with video using FFmpeg

## Speed Configuration

Adjust the `commandDelay` and narration durations based on your needs:

| Setting | Value | Use Case |
|---------|-------|----------|
| `commandDelay: 300` | Fast | Quick demos |
| `commandDelay: 600` | Normal | Standard tutorials |
| `commandDelay: 1000` | Slow | Detailed explanations |

### Narration Timing Guide

| Duration | Words | Use For |
|----------|-------|---------|
| 2500ms | ~8-10 | Short phrases |
| 4000ms | ~15-18 | Standard sentences |
| 5500ms | ~22-25 | Longer explanations |

## Tips

1. **Use `cy.wait()` strategically** - Add pauses after important actions
2. **Highlight sparingly** - Only highlight what you're talking about
3. **Chapter markers** - Help viewers navigate in longer videos
4. **Test first without slow-down** - Ensure test passes before recording
5. **Keep videos under 5 minutes** - Split longer tutorials into parts

## Running Only Doc Tests

Use tags to filter:

```bash
# Run only documentation tests
pnpm cy:run --env grepTags=@doc

# Run only tutorial tests
pnpm cy:run --env grepTags=@tutorial

# Exclude doc tests from regular test runs
pnpm cy:run --env grepTags=-@doc
```

## Future Enhancements

- [ ] Automated subtitle generation script
- [ ] Integration with AI narration APIs
- [ ] FFmpeg post-processing script
- [ ] Multi-language support
- [ ] Automated upload to docs site
