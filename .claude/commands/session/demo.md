# /session:demo

Run a live visual demo of the implemented feature.

---

## Syntax

```
/session:demo [--record]
```

---

## Behavior

Opens a browser and demonstrates the implemented feature visually using Playwright.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:demo                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Load session context                                        │
│     - Read requirements.md (ACs)                                │
│     - Read plan.md (features)                                   │
│     ↓                                                           │
│  2. Start dev server (if not running)                           │
│     ↓                                                           │
│  3. Launch browser with Playwright                              │
│     ↓                                                           │
│  4. Execute demo flow                                           │
│     - Navigate to relevant pages                                │
│     - Demonstrate each AC                                       │
│     - Explain what's happening                                  │
│     ↓                                                           │
│  5. Generate demo summary                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
🎬 SESSION DEMO

Session: stories/2026-01-11-new-products-entity
ACs to demonstrate: 5

─────────────────────────────────────────

🚀 STARTING DEMO

Starting dev server...
✓ Server running at http://localhost:3000

Launching browser...
✓ Browser ready

─────────────────────────────────────────

📋 DEMO: AC1 - Create Product

[Browser] Navigating to /dashboard/products
[Browser] Clicking "New Product" button
[Browser] Filling form:
  - Name: "Demo Product"
  - Price: 99.99
  - Description: "Test product for demo"
[Browser] Clicking "Save"

✓ Product created successfully

─────────────────────────────────────────

📋 DEMO: AC2 - Upload Images

[Browser] Clicking "Add Images"
[Browser] Selecting test image
[Browser] Uploading...

✓ Image uploaded and displayed

─────────────────────────────────────────

📋 DEMO: AC3 - Assign Categories

[Browser] Opening category selector
[Browser] Selecting "Electronics"
[Browser] Saving changes

✓ Category assigned

─────────────────────────────────────────

📊 DEMO SUMMARY

ACs Demonstrated: 5/5
Issues Found: 0
Screenshots: 5 saved to _tmp/demo/

Demo complete!
```

---

## With Recording

```
/session:demo --record
```

Output:

```
🎬 SESSION DEMO (RECORDING)

Recording to: _tmp/demo/2026-01-11-products-demo.mp4

[Recording started]
...
[Recording stopped]

✓ Video saved: _tmp/demo/2026-01-11-products-demo.mp4
Duration: 2:34
```

---

## Options

| Option | Description |
|--------|-------------|
| `--record` | Record demo as video |
| `--ac <number>` | Demo specific AC only |
| `--mobile` | Demo in mobile viewport |
| `--slow` | Slow down actions for visibility |

---

## Demo Configuration

In session's `demo.config.json`:

```json
{
  "baseUrl": "http://localhost:3000",
  "credentials": {
    "email": "admin@test.com",
    "password": "Test1234"
  },
  "flows": [
    {
      "ac": "AC1",
      "steps": [
        { "action": "navigate", "path": "/dashboard/products" },
        { "action": "click", "selector": "[data-cy=new-product]" }
      ]
    }
  ]
}
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:explain` | Explain code implementation |
| `/session:validate` | Validate before demo |
| `/session:close` | Close session |
