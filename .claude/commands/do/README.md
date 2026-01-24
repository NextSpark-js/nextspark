# do: Commands

Action-oriented commands that enforce reading skills and how-tos before executing tasks.

## Philosophy

Each `do:` command is **MINIMAL** - it only points to where to read the full instructions:
- **Skills** (`.claude/skills/`) contain patterns, conventions, and automation scripts
- **How-tos** (`.claude/commands/how-to/`) contain step-by-step procedures

## Available Commands

### Core Development

| Command | Description | Reads |
|---------|-------------|-------|
| `/do:create-entity` | Create a new entity with all files | `entity-system`, `database-migrations` |
| `/do:create-migration` | Create a database migration | `database-migrations` |
| `/do:create-api` | Create an API endpoint | `nextjs-api-development`, `entity-api` |
| `/do:create-plugin` | Create a new plugin | `create-plugin`, `plugins` |
| `/do:create-theme` | Create a new theme | `create-theme` |

### Database

| Command | Description | Reads |
|---------|-------------|-------|
| `/do:mock-data` | Generate sample/mock data | `database-migrations` |
| `/do:reset-db` | Reset and migrate database | `database-migrations` |

### Page Builder

| Command | Description | Reads |
|---------|-------------|-------|
| `/do:validate-blocks` | Validate page builder blocks | `page-builder-blocks`, `block-decision-matrix` |
| `/do:update-selectors` | Sync selectors between components, core, and POMs | `cypress-selectors` |

### Background Tasks

| Command | Description | Reads |
|---------|-------------|-------|
| `/do:setup-scheduled-action` | Create a scheduled action handler | `scheduled-actions` |

### NPM & Releases

| Command | Description | Reads |
|---------|-------------|-------|
| `/do:npm-publish` | Publish packages to npm | `how-to/releases/npm-publish` |
| `/do:npm-version` | Increment package versions | `how-to/releases/npm-version` |
| `/do:release-version` | Create a core version release | `how-to/releases/release-version` |
| `/do:test-package` | Test npm package from scratch | `npm-development-workflow` |

### Git & GitHub

| Command | Description | Reads |
|---------|-------------|-------|
| `/do:sync-code-review` | Sync with PR code review: evaluate, fix, respond | `github` |

### Meta

| Command | Description | Reads |
|---------|-------------|-------|
| `/do:use-skills` | **Enforcement**: Read and apply relevant skills for any task | `skills/README.md` |

## Usage Examples

```bash
# For specific tasks
/do:create-entity products
/do:create-migration add-status-to-orders
/do:npm-publish

# Test package before publishing
/do:test-package

# For general tasks (skill enforcement)
/do:use-skills create a webhook integration
/do:use-skills add authentication to the API
```

## How It Works

1. **User invokes** `/do:create-entity products`
2. **Claude reads** the command file `do/create-entity.md`
3. **Command says** "MANDATORY: Read `.claude/skills/entity-system/SKILL.md`"
4. **Claude reads** the skill completely
5. **Claude executes** following the skill's patterns and checklists

## Adding New Commands

To add a new `do:` command:

1. Identify the skill(s) that cover the task
2. Create a minimal `.md` file in `/commands/do/`
3. Reference the skill with "MANDATORY: Read..."
4. Include quick reference section for common operations
5. Update this README

## Related

- `/commands/how-to/` - Detailed step-by-step procedures
- `/commands/session/` - Session workflow commands
- `/skills/` - Full skill documentation with scripts
