# Commands (v4.0)

> **Version 4.0** - 24 slash commands organized by category.

## Introduction

Commands are **pre-built workflows** that orchestrate multiple agents to execute common development tasks. Commands simplify complex workflows by combining multiple agent actions into single executable commands.

> **Note:** These are pre-built commands - you can use them as-is, modify them, or create your own. See [Customization](./10-customization.md) and the "Creating Custom Commands" section below.

**Key Changes in v4.0:**
- **24 Commands** (up from 11) - More specialized workflows
- **Namespace Pattern** - `category:action` naming convention
- **Step Integration** - Commands aligned with 19-phase workflow
- **Gate Awareness** - Commands understand quality gates

---

## Command Summary

### By Category

| Category | Commands | Purpose |
|----------|----------|---------|
| **Task** | 6 | Main development workflow |
| **Database** | 3 | Entity and migration management |
| **Testing** | 3 | Test writing and execution |
| **Block** | 5 | Page builder blocks |
| **Plugin** | 1 | Plugin scaffolding |
| **Fix** | 2 | Error resolution |
| **Doc** | 2 | Documentation generation |
| **Release** | 1 | Version management |
| **Workflow** | 1 | System maintenance |

### Quick Reference

| Command | Description | Agents |
|---------|-------------|--------|
| `/task:requirements` | Generate detailed requirements | product-manager |
| `/task:plan` | Create technical plan + ClickUp task | PM + Architect |
| `/task:execute` | Execute 19-phase workflow | Multiple |
| `/task:refine` | Refine session before execution | PM or Architect |
| `/task:scope-change` | Handle scope changes | PM + code-reviewer |
| `/task:pending` | Document pending items | Any |
| `/db:entity` | Generate entity migration | db-developer |
| `/db:sample` | Generate sample data | db-developer |
| `/db:fix` | Fix migration errors | db-developer |
| `/test:write` | Write Cypress tests | qa-automation |
| `/test:run` | Execute test suite | qa-automation |
| `/test:fix` | Fix failing tests | qa-automation |
| `/block:create` | Create new block | block-developer |
| `/block:update` | Modify existing block | block-developer |
| `/block:validate` | Validate block structure | block-developer |
| `/block:list` | List available blocks | block-developer |
| `/block:docs` | Generate block documentation | block-developer |
| `/plugin:create` | Create new plugin | plugin-creator |
| `/fix:build` | Fix build errors | Multiple |
| `/fix:bug` | Fix reported bug | Multiple |
| `/doc:feature` | Generate feature docs | documentation-writer |
| `/doc:demo-feature` | Generate demo video | demo-video-generator |
| `/release:version` | Create version release | release-manager |
| `/workflow-update` | Maintain workflow system | workflow-maintainer |

---

## Task Commands

### /task:requirements

**Step 1** - Generate detailed feature requirements through interactive questions

```bash
/task:requirements [feature description]
```

**What It Does:**
1. Launches `product-manager` agent
2. Asks 4 mandatory PM Decisions:
   - Dev Type (Feature/Theme/Plugin/Core)
   - DB Policy (Reset/Incremental)
   - Requires Blocks (Yes/No)
   - Plugin Config (if applicable)
3. Gathers requirements interactively
4. Creates session folder with:
   - `requirements.md` (with AC classification)
   - `scope.json` (permissions)
   - `context.md` (initialized)

**Output:**
```text
.claude/sessions/2025-12-15-products-crud-v1/
├── requirements.md    ✅ Created
├── scope.json         ✅ Created
└── context.md         ✅ Initialized
```

**Next Step:** `/task:plan` to create technical plan

---

### /task:plan

**Step 2** - Create ClickUp task (optional) and technical plan

```bash
/task:plan [session-path]
/task:plan .claude/sessions/2025-12-15-products-crud-v1
```

**What It Does:**
1. Launches `product-manager` to:
   - Create ClickUp task (optional)
   - Create `clickup_task.md`
2. Launches `architecture-supervisor` to:
   - Create `plan.md` (19-phase breakdown)
   - Create `progress.md` (tracking template)
   - Initialize `tests.md` and `pendings.md`

**Output:**
```text
.claude/sessions/2025-12-15-products-crud-v1/
├── clickup_task.md    ✅ Created (optional)
├── plan.md            ✅ Created
├── progress.md        ✅ Created
├── tests.md           ✅ Initialized
└── pendings.md        ✅ Initialized
```

**Next Step:** `/task:execute` to begin development

---

### /task:execute

**Step 3** - Execute complete 19-phase workflow v4.0 with gates

```bash
/task:execute [session-path]
/task:execute .claude/sessions/2025-12-15-products-crud-v1
```

**What It Does:**

Executes the full 19-phase workflow based on PM Decisions:

```text
BLOCK 2: Foundation (Conditional)
├─ Phase 3: plugin-creator (if New Plugin)
├─ Phase 4: plugin-validator [GATE]
├─ Phase 3b: theme-creator (if New Theme)
├─ Phase 4b: theme-validator [GATE]
├─ Phase 5: db-developer
└─ Phase 6: db-validator [GATE]

BLOCK 3: Backend
├─ Phase 7: backend-developer
├─ Phase 8: backend-validator [GATE]
└─ Phase 9: api-tester [GATE + RETRY]

BLOCK 4: Blocks (Conditional)
└─ Phase 10: block-developer (if Requires Blocks)

BLOCK 5: Frontend
├─ Phase 11: frontend-developer
├─ Phase 12: frontend-validator [GATE]
└─ Phase 13: functional-validator [GATE]

BLOCK 6: QA
├─ Phase 14: qa-manual [GATE + RETRY]
└─ Phase 15: qa-automation [GATE]

BLOCK 7: Finalization
├─ Phase 16: code-reviewer
├─ Phase 17: unit-test-writer
├─ Phase 18: documentation-writer (optional)
└─ Phase 19: demo-video-generator (optional)
```

**Gate Behavior:**
- Gates BLOCK workflow if validation fails
- Some gates have retry logic (api-tester, qa-manual)
- Failed gates route back to appropriate developer

**Output:**
- Complete feature implementation
- All gates passed
- Code review complete
- Ready for merge

---

### /task:refine

**Pre-Execution** - Refine session requirements and/or plan before development starts

```bash
/task:refine [session-path] [changes]
```

**Example:**
```bash
/task:refine .claude/sessions/2025-12-15-products-crud-v1 Add bulk delete requirement
```

**What It Does:**
1. Verifies development hasn't started (progress.md shows only Phase 1-2)
2. Updates `requirements.md` or `plan.md` based on changes
3. Records refinement in `context.md`

**When to Use:**
- Adjusting requirements before development begins
- Changing architectural decisions
- Adding/removing acceptance criteria

**Note:** Use `/task:scope-change` if development has already started.

---

### /task:scope-change

Handle scope changes during development

```bash
/task:scope-change [change description]
```

**Example:**
```bash
/task:scope-change Need to add photo crop and remove bio field
```

**What It Does:**
1. Launches `product-manager` to:
   - Update `requirements.md`
   - Update ClickUp task
   - Add comment documenting change
2. Launches `code-reviewer` to:
   - Validate implementation against new scope
   - Check for introduced technical debt

**Output:**
- Updated requirements
- ClickUp task updated
- Scope change documented
- Quality validation

---

### /task:pending

Document pending items discovered during development

```bash
/task:pending [session-path] [pending description]
```

**Example:**
```bash
/task:pending .claude/sessions/2025-12-15-products-crud-v1 Pagination needs performance optimization
```

**What It Does:**
1. Adds entry to `pendings.md` with:
   - Description
   - Detectado por (which agent/phase)
   - Priority
   - Category
   - Recommendation for next version

**When to Use:**
- Items discovered but out of scope
- Future enhancements identified
- Technical debt to address later

---

## Database Commands

### /db:entity

**DB Step 1** - Generate migration for entity with relations and metadata support

```bash
/db:entity [entity description]
```

**Example:**
```bash
/db:entity Create products table with name, price, description, team_id FK
```

**What It Does:**
1. Launches `db-developer` agent
2. Analyzes existing migrations for patterns
3. Creates new migration file following conventions
4. Includes:
   - Core fields (id, created_at, updated_at)
   - Team Mode support (team_id FK if enabled)
   - Metadata JSON field
   - Indexes for performance

**Output:**
```sql
-- migrations/XXX_create_products.sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  team_id UUID REFERENCES teams(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_team ON products(team_id);
```

---

### /db:sample

**DB Step 2** - Generate coherent sample data for database entities

```bash
/db:sample [entity or session-path]
```

**Example:**
```bash
/db:sample products
/db:sample .claude/sessions/2025-12-15-products-crud-v1
```

**What It Does:**
1. Launches `db-developer` agent
2. Reads entity schema from migration
3. Creates sample data migration with:
   - 20+ records per entity
   - Realistic, coherent data
   - Test users with correct password hash
   - Team assignments (if Team Mode)

**Output:**
```sql
-- migrations/XXX_products_sample_data.sql
INSERT INTO products (name, price, description, team_id) VALUES
  ('Premium Widget', 99.99, 'High-quality widget...', (SELECT id FROM teams LIMIT 1)),
  ('Basic Gadget', 29.99, 'Entry-level gadget...', (SELECT id FROM teams LIMIT 1)),
  -- ... 18+ more records
```

---

### /db:fix

Test and fix database migrations iteratively until success

```bash
/db:fix [optional error context]
```

**Example:**
```bash
/db:fix
/db:fix "foreign key constraint violation"
```

**What It Does:**
1. Runs `pnpm db:migrate`
2. If error:
   - Analyzes error message
   - Launches `db-developer` to fix
   - Retries (max 3 attempts)
3. If success:
   - Runs `pnpm db:verify`
   - Confirms structure

**Retry Logic:**
- Max 3 attempts
- Each attempt analyzes specific error
- Stops on success or max retries

---

## Testing Commands

### /test:write

**Test Step 1** - Write or update Cypress tests (API and UAT)

```bash
/test:write [session-path or test description]
```

**Example:**
```bash
/test:write .claude/sessions/2025-12-15-products-crud-v1
/test:write "API tests for products CRUD"
```

**What It Does:**
1. Launches `qa-automation` agent
2. Reads session files (requirements, plan, tests.md)
3. Creates/updates Cypress tests:
   - API tests for endpoints
   - UAT tests for UI flows
4. Updates `tests.md` with:
   - Test file locations
   - data-cy selectors used
   - AC coverage mapping

**Test Types:**
- **API Tests:** `cypress/e2e/api/products-api.cy.ts`
- **UAT Tests:** `cypress/e2e/uat/products-uat.cy.ts`

---

### /test:run

**Test Step 2** - Execute Cypress test suite

```bash
/test:run [options]
```

**Examples:**
```bash
/test:run                           # Run all tests
/test:run --spec products           # Run specific spec
/test:run --tag @scope-products-v1  # Run by tag
/test:run --api                     # Run only API tests
/test:run --uat                     # Run only UAT tests
```

**What It Does:**
1. Launches `qa-automation` agent
2. Executes Cypress tests based on options
3. Updates `tests.md` with results
4. Reports pass/fail status

**Output:**
```text
Test Results:
- Total: 24
- Passed: 22
- Failed: 2
- Skipped: 0

Failed Tests:
1. products-uat.cy.ts > should delete product
2. products-api.cy.ts > should return 400 on invalid
```

---

### /test:fix

Fix failing Cypress tests iteratively until all pass

```bash
/test:fix [test file or session-path]
```

**Example:**
```bash
/test:fix products-uat.cy.ts
/test:fix .claude/sessions/2025-12-15-products-crud-v1
```

**What It Does:**
1. Launches `qa-automation` agent
2. Runs tests to identify failures
3. For each failure:
   - Analyzes error
   - Fixes test or code
   - Retries
4. Uses Smart Retry Strategy with tags:
   - `@in-develop` for tests being fixed
   - `@scope-{session}` for session tests

**Retry Logic:**
- Iterates until 100% pass
- Tags failing tests for targeted runs
- Removes tags after passing

---

## Block Commands

### /block:create

Create a new page builder block with complete file structure

```bash
/block:create [block description]
/block:create --theme=blog [block description]
```

**Example:**
```bash
/block:create FAQ accordion with questions and answers
/block:create --theme=crm Pricing table with monthly/yearly toggle
```

**What It Does:**
1. Launches `block-developer` agent
2. Determines theme (--theme flag or active theme)
3. Creates 5-file structure:
   - `config.ts` - Block metadata
   - `schema.ts` - Zod validation
   - `fields.ts` - Editor field definitions
   - `component.tsx` - React component
   - `index.ts` - Re-exports
4. Runs `node core/scripts/build/registry.mjs`
5. Verifies block in `BLOCK_REGISTRY`

**Output:**
```text
contents/themes/default/blocks/faq-accordion/
├── config.ts     ✅
├── schema.ts     ✅
├── fields.ts     ✅
├── component.tsx ✅
└── index.ts      ✅

Registry: ✅ Block registered
```

---

### /block:update

Modify an existing page builder block

```bash
/block:update [slug] [changes]
/block:update --theme=blog [slug] [changes]
```

**Example:**
```bash
/block:update hero Add subtitle field
/block:update --theme=crm features-grid Allow up to 6 columns
```

**What It Does:**
1. Launches `block-developer` agent
2. Locates block in theme
3. Updates files:
   - `schema.ts` - Add new field with `.optional().default()`
   - `fields.ts` - Add field definition
   - `component.tsx` - Use new prop safely
4. Maintains backward compatibility
5. Rebuilds registry

---

### /block:validate

Validate block structure and consistency

```bash
/block:validate [slug|all]
/block:validate --theme=blog [slug|all]
```

**Example:**
```bash
/block:validate hero        # Validate single block
/block:validate all         # Validate all blocks
/block:validate --theme=blog all
```

**Validation Checks:**
- [ ] All 5 files exist
- [ ] config.ts has valid slug, name, category, icon
- [ ] schema.ts extends baseBlockSchema
- [ ] fields.ts uses base field spreads
- [ ] component.tsx has data-cy attribute
- [ ] Block appears in BLOCK_REGISTRY

**Output:**
```text
Validation Results: default

Summary:
- Validated: 5 blocks
- Passed: 4
- Failed: 1

hero - PASSED ✅
features-grid - PASSED ✅
faq-accordion - FAILED ❌
  - Missing data-cy attribute
```

---

### /block:list

List available blocks in the page builder

```bash
/block:list
/block:list --theme=blog
/block:list --all
```

**Output:**
```text
Blocks in Theme: default

Category: hero
| Slug | Name | Icon |
|------|------|------|
| hero | Hero Section | Rocket |

Category: content
| Slug | Name | Icon |
|------|------|------|
| features-grid | Features Grid | Grid |
| text-content | Text Content | Type |

Total: 5 blocks
```

---

### /block:docs

Generate documentation for a page builder block

```bash
/block:docs [slug]
/block:docs --theme=blog [slug]
```

**Example:**
```bash
/block:docs hero
```

**Output:** Comprehensive markdown documentation including:
- Block overview and metadata
- Props reference (base + block-specific)
- Editor fields by tab
- JSON usage example
- Cypress selector

---

## Plugin Commands

### /plugin:create

Create a new plugin with complete file structure

```bash
/plugin:create [plugin name] [options]
```

**Example:**
```bash
/plugin:create analytics --complexity=service
/plugin:create payments --complexity=full-featured --with-entities
```

**What It Does:**
1. Launches `plugin-creator` agent
2. Scaffolds plugin from preset:
   - `plugin.config.ts` - Configuration
   - `lib/core.ts` - Main logic
   - `lib/types.ts` - TypeScript types
   - API routes (if service/full-featured)
   - Components (if service/full-featured)
   - Migrations (if with-entities)
3. Registers in `plugin-sandbox` theme
4. Rebuilds registries

**Complexity Options:**
- `utility` - Helper functions only
- `service` - API + components + hooks
- `full-featured` - Entities + migrations + full UI

---

## Fix Commands

### /fix:build

Automatically diagnose and fix build errors

```bash
/fix:build [optional context]
```

**Example:**
```bash
/fix:build
/fix:build "unused imports after refactoring"
```

**What It Does:**
1. Runs `pnpm build` to capture errors
2. Categorizes errors:
   - FRONTEND → `frontend-developer`
   - BACKEND → `backend-developer`
   - PLUGIN → `plugin-creator`
   - REGISTRY → `backend-developer`
3. Launches appropriate agent
4. Retries until build passes (max 5)

**Output:**
```text
Error: 'useState' is declared but never used
Category: FRONTEND
Agent: frontend-developer

✅ Fixed: Removed unused import
✅ Build succeeded (attempt 1/5)
```

---

### /fix:bug

Fix a reported bug with automatic test creation

```bash
/fix:bug [bug description or ClickUp task URL]
```

**Example:**
```bash
/fix:bug "Products table pagination shows wrong count"
/fix:bug https://app.clickup.com/t/86abc123
```

**What It Does:**
1. Analyzes bug description
2. Locates affected code
3. Launches appropriate developer:
   - Backend bug → `backend-developer`
   - Frontend bug → `frontend-developer`
4. Creates regression test
5. Verifies fix
6. Updates ClickUp (if linked)

---

## Documentation Commands

### /doc:feature

Generate comprehensive documentation for a completed feature

```bash
/doc:feature [session-path]
```

**Example:**
```bash
/doc:feature .claude/sessions/2025-12-15-products-crud-v1
```

**Prerequisites:**
- QA passed (Phase 14-15 complete)
- Code review passed (Phase 16 complete)

**What It Does:**
1. Launches `documentation-writer` agent
2. Reads session files for context
3. Generates:
   - Feature documentation
   - API reference (if applicable)
   - Code examples
   - Changelog entry

---

### /doc:demo-feature

Generate a demo video for a feature using Cypress with narration

```bash
/doc:demo-feature [session-path]
```

**Example:**
```bash
/doc:demo-feature .claude/sessions/2025-12-15-products-crud-v1
```

**What It Does:**
1. Launches `demo-video-generator` agent
2. Creates Cypress spec for demo flow
3. Records video with:
   - Step-by-step narration
   - UI interactions
   - Feature highlights

---

## Release Commands

### /release:version

Create a new core version release with semantic versioning

```bash
/release:version [version type or specific version]
```

**Examples:**
```bash
/release:version              # Auto-detect
/release:version patch        # Bump patch (0.1.0 → 0.1.1)
/release:version minor        # Bump minor (0.1.0 → 0.2.0)
/release:version major        # Bump major (0.5.0 → 1.0.0)
/release:version v2.0.0       # Specific version
```

**What It Does:**
1. Launches `release-manager` agent
2. Analyzes recent commits:
   - Breaking changes → MAJOR
   - New features → MINOR
   - Bug fixes → PATCH
3. Recommends version bump
4. Waits for user approval
5. Executes release:
   - Updates `core.version.json`
   - Creates Git commit and tag
   - Pushes to remote

**Prerequisites:**
- Clean git working directory
- On main/master branch
- Tests passing

---

## Workflow Commands

### /workflow-update

Maintain, create, or modify Claude Code AI workflow system

```bash
/workflow-update [request]
```

**Examples:**
```bash
/workflow-update "Add new qa-performance agent"
/workflow-update "Update api-tester to retry 5 times"
/workflow-update "Create /deploy command"
```

**What It Does:**
1. Launches `workflow-maintainer` agent
2. Analyzes impact on:
   - Other agents
   - Commands
   - Session templates
   - Documentation
3. Makes changes to `.claude/`
4. If core project, asks about syncing to presets

---

## Typical Workflow

```bash
# Step 1: Gather requirements
/task:requirements Add products CRUD functionality

# Step 2: Create plan and ClickUp task
/task:plan .claude/sessions/2025-12-15-products-crud-v1

# Step 3: Execute full workflow
/task:execute .claude/sessions/2025-12-15-products-crud-v1

# If build errors occur
/fix:build

# If tests fail
/test:fix .claude/sessions/2025-12-15-products-crud-v1

# Generate documentation (optional)
/doc:feature .claude/sessions/2025-12-15-products-crud-v1

# Create release
/release:version
```

---

## Creating Custom Commands

### Command File Structure

```markdown
---
description: Brief description shown in command list
---

# Command Name

Detailed instructions for the command.

**Input:**
{{{ input }}}

## Phase 1: First Step

Instructions for first phase...

## Phase 2: Second Step

Instructions for second phase...
```

### Naming Conventions

- Use `category:action` pattern
- Categories: task, db, test, block, plugin, fix, doc, release
- Lowercase with colons
- Examples: `api:test`, `theme:validate`, `data:export`

### Location

Commands are stored in `.claude/commands/`:

```text
.claude/commands/
├── task:requirements.md
├── task:plan.md
├── db:entity.md
└── custom:command.md    # Your custom commands
```

---

## Next Steps

- **[Workflow Phases](./04-workflow-phases.md)** - 19-phase workflow details
- **[Quality Gates](./07-quality-gates.md)** - Gate validation during execution
- **[Sessions](./05-sessions.md)** - Session file structure
- **[Agents](./03-agents.md)** - Agent responsibilities
