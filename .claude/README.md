# Claude Code AI Workflow System

This directory contains the **template files** for the Claude Code AI workflow system with ClickUp integration. These templates are managed by the core boilerplate and can be updated without overwriting your personalized configurations.

## 🏗️ Architecture Overview

The system uses a **template-based approach** to separate core-managed files from user-customizable configurations:

- **`core/presets/ai-workflow/claude/`** (this directory) - Template files managed by the boilerplate core
- **`.claude/`** (project root) - Your working directory with personalized configurations

## 📁 Directory Structure

```
core/presets/ai-workflow/claude/              # TEMPLATES (core-managed)
├── README.md                         # This file
├── config/
│   ├── agents.example.json            # Template with demo credentials
│   ├── workflow.example.md          # Template workflow documentation
│   └── settings.local.example.json  # Template permissions config
├── agents/                           # 7 agent definition files
│   ├── architecture-supervisor.md
│   ├── backend-developer.md
│   ├── code-reviewer.md
│   ├── dev-plugin.md
│   ├── documentation-writer.md
│   ├── frontend-developer.md
│   ├── product-manager.md
│   └── qa-tester.md
├── commands/                         # Slash command definitions
│   ├── document-feature.md
│   ├── execute-task.md
│   ├── init-task.md
│   └── scope-change.md
├── sessions/
│   └── README.md                    # Session workflow guide
└── tools/                            # Tool-specific documentation
    ├── sessions/
    │   └── templates/               # Session file templates
    │       ├── requirements.md
    │       ├── clickup_task.md
    │       ├── scope.json
    │       ├── plan.md
    │       ├── progress.md
    │       ├── context.md
    │       ├── tests.md
    │       └── pendings.md
    └── clickup/
        ├── api.md                    # ClickUp API reference
        ├── mcp.md                    # ClickUp MCP integration
        └── templates/
            └── task.md               # Task template
```

## 🚀 Setup Instructions

### First Time Setup

1. **Run the setup script:**
   ```bash
   npm run setup:claude
   ```

   This copies all template files from `core/presets/ai-workflow/claude/` to `.claude/` in your project root.

2. **Create your personalized configuration files:**
   ```bash
   # Copy example files to create your configs
   cp .claude/config/agents.example.json .claude/config/agents.json
   cp .claude/config/workflow.example.md .claude/config/workflow.md
   cp .claude/config/settings.local.example.json .claude/config/settings.local.json
   ```

3. **Add your credentials:**
   - Edit `.claude/config/agents.json` with your ClickUp API token and project IDs
   - Edit `.claude/config/workflow.md` to match your project workflow (optional)
   - Edit `.claude/config/settings.local.json` to adjust permissions (optional)

4. **Start using Claude Code:**
   ```bash
   # Your slash commands are now available:
   /init-task       # Initialize new task with PM + architect
   /execute-task    # Execute development workflow
   /scope-change    # Handle scope changes
   /document-feature # Generate feature documentation
   ```

### Updating Templates from Core

When the boilerplate updates the core templates:

```bash
git pull                    # Get latest core templates
npm run setup:claude       # Update templates in .claude/
```

**Your personalized files are safe:**
- `.claude/config/agents.json` - NEVER overwritten
- `.claude/config/workflow.md` - NEVER overwritten
- `.claude/config/settings.local.json` - NEVER overwritten
- `.claude/sessions/[your-sessions]/` - NEVER touched

**What gets updated:**
- All `*.example.*` files in `config/`
- All agent definitions in `agents/`
- All command definitions in `commands/`
- Session templates in `tools/sessions/templates/`
- Tool documentation in `tools/`

## 📋 File Types & Update Strategy

### Template Files (Always Updated)

These files are copied from core every time you run `npm run setup:claude`:

| Directory | Files | Purpose |
|-----------|-------|---------|
| `agents/` | All `.md` files | Agent definitions and behaviors |
| `commands/` | All `.md` files | Slash command implementations |
| `tools/sessions/templates/` | `*.md`, `*.json` | Session file templates |
| `tools/` | All files | Tool documentation and guides |
| `config/` | `*.example.*` | Configuration examples |

### User-Managed Files (Never Overwritten)

These files are created by you and **never touched** by the setup script:

| File | Purpose | Gitignored |
|------|---------|------------|
| `.claude/config/agents.json` | Your ClickUp credentials | ✅ Yes |
| `.claude/config/workflow.md` | Your project workflow | ✅ Yes |
| `.claude/config/settings.local.json` | Your permissions | ✅ Yes |
| `.claude/sessions/[name]/` | Your work sessions | ✅ Yes |

### Example Files (Templates)

Files with `.example.*` in their name are **always updated** from core. They serve as:
- Reference for correct configuration format
- Starting point for your personalized configs
- Documentation of available options

## 🔄 Update Workflow

### Scenario 1: Core Updates Agent Definitions

```bash
# Boilerplate releases new agent improvements
git pull

# Update your local templates
npm run setup:claude

# Your credentials and sessions are preserved
# New agent capabilities are immediately available
```

### Scenario 2: You Customize Commands

```bash
# You can add custom commands:
# Create: .claude/commands/my-custom-command.md

# When you update core templates:
npm run setup:claude

# Core commands are updated
# Your custom commands are preserved
```

### Scenario 3: You Want to Reset

```bash
# Backup your credentials first!
cp .claude/config/agents.json ~/agents-backup.md

# Remove everything
rm -rf .claude/

# Reinstall fresh templates
npm run setup:claude

# Restore your credentials
cp ~/agents-backup.md .claude/config/agents.json
```

## 🔒 Security & Gitignore

Your personalized configuration files containing credentials are **automatically gitignored**:

```gitignore
# These files are NEVER committed to git:
.claude/config/agents.json
.claude/config/workflow.md
.claude/config/settings.local.json
.claude/sessions/*/  # Your work sessions
```

**Safe to commit (and are in git):**
- `.claude/agents/` - Agent definitions
- `.claude/commands/` - Command definitions
- `.claude/config/*.example.*` - Configuration examples
- `.claude/sessions/README.md` - Session documentation
- `.claude/tools/sessions/templates/` - Session templates
- `.claude/tools/` - Tool documentation

## 📖 Key Files Explained

### `config/agents.json`
Contains your ClickUp API credentials and project configuration:
- ClickUp API token
- Workspace, Space, List IDs
- User IDs for assignments
- Custom field mappings

**Important:** This file contains secrets. Never commit it to git.

### `config/workflow.md`
Documents your project's development workflow:
- Session-based task management process
- Agent coordination patterns
- ClickUp integration workflows
- Approval and review processes

You can customize this to match your team's workflow.

### `config/settings.local.json`
Controls Claude Code's permissions for this project:
- Allowed/denied tool access
- Auto-approved commands
- Safety settings

Customize based on your trust level and project needs.

### `agents/*.md`
Defines specialized agent behaviors:
- **architecture-supervisor** - System design and planning
- **backend-developer** - API and database work
- **code-reviewer** - Code quality validation
- **dev-plugin** - Plugin development specialist
- **documentation-writer** - Documentation generation
- **frontend-developer** - UI implementation
- **product-manager** - Task management and ClickUp integration
- **qa-tester** - Testing and quality assurance

### `commands/*.md`
Slash commands for common workflows:
- **/init-task** - Initialize task with PM requirements + architect planning
- **/execute-task** - Full development workflow (Backend → Frontend → QA → Review)
- **/scope-change** - Handle scope changes mid-development
- **/document-feature** - Generate comprehensive feature documentation

### `sessions/`
Session-based task tracking system:
- Each feature gets its own session folder
- Templates provide consistent structure
- Tracks plan, progress, context, ClickUp task
- Preserves development history

## 🤝 Contributing Updates to Core

If you improve an agent definition, command, or workflow that would benefit other users:

1. Update the file in `core/presets/ai-workflow/claude/`
2. Remove any project-specific details
3. Update this README if needed
4. Submit a PR to the boilerplate repository

## 📚 Additional Resources

- **Main Documentation:** See `/CLAUDE.md` in project root for complete usage guide
- **Rules System:** See `/.rules/` for development standards and agent integration
- **ClickUp Integration:** See `tools/clickup/` for API and MCP documentation
- **Session Workflow:** See `sessions/README.md` for session-based task management

---

**System Version:** 1.0.0
**Last Updated:** 2025-01-20
**Maintained by:** SaaS Boilerplate Core Team
