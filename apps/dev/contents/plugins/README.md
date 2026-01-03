# Plugin Development

**🚨 IMPORTANT: Plugin development documentation has moved to the centralized rules system.**

## 📚 Official Documentation Location

Plugin development guidelines and patterns are now available in:

**📋 [.rules/plugins.md](../../.rules/plugins.md)** - Complete plugin development rules

This file follows the project's established documentation standards and includes:

- Plugin architecture and registry integration
- Claude Code agent coordination
- TodoWrite planning templates
- Comprehensive testing requirements
- Build-time optimization patterns
- Development workflow automation

## Quick Links

- **Core Rules**: [.rules/core.md](../../.rules/core.md)
- **Testing Rules**: [.rules/testing.md](../../.rules/testing.md)
- **Planning Rules**: [.rules/planning.md](../../.rules/planning.md)
- **Plugin Rules**: [.rules/plugins.md](../../.rules/plugins.md)

## Development Commands

```bash
# Build plugin registry
npm run build-registry

# Watch mode for development
npm run build-registry -- --watch

# Validate plugin configuration
npm run validate-registry
```

---

**Note**: This centralized documentation approach ensures consistency, Claude Code optimization, and prevents documentation fragmentation across the project.