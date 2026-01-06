#!/usr/bin/env python3
"""
Scaffold Block - Generate Page Builder Block Structure

Creates the 5 required files for a new page builder block:
- config.ts
- schema.ts
- fields.ts
- component.tsx
- index.ts

Usage:
    python scaffold-block.py [--theme THEME] [--slug SLUG] [--name NAME]

Interactive mode if no arguments provided.
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

# Block categories
CATEGORIES = [
    'hero', 'features', 'cta', 'content', 'testimonials',
    'pricing', 'faq', 'stats', 'gallery', 'timeline',
    'contact', 'newsletter', 'team', 'portfolio', 'custom'
]

# Common Lucide icons for blocks
COMMON_ICONS = [
    'LayoutTemplate', 'Grid', 'List', 'Star', 'Quote',
    'DollarSign', 'HelpCircle', 'BarChart', 'Image', 'Clock',
    'Mail', 'Users', 'Briefcase', 'Sparkles', 'Box'
]


def to_kebab_case(s: str) -> str:
    """Convert string to kebab-case."""
    s = re.sub(r'([A-Z])', r'-\1', s)
    s = re.sub(r'[\s_]+', '-', s)
    return s.lower().strip('-')


def to_pascal_case(s: str) -> str:
    """Convert string to PascalCase."""
    return ''.join(word.capitalize() for word in re.split(r'[-_\s]+', s))


def to_camel_case(s: str) -> str:
    """Convert string to camelCase."""
    pascal = to_pascal_case(s)
    return pascal[0].lower() + pascal[1:] if pascal else ''


def get_project_root() -> Path:
    """Get project root directory."""
    # Look for package.json or .env
    current = Path.cwd()
    while current != current.parent:
        if (current / 'package.json').exists():
            return current
        current = current.parent
    return Path.cwd()


def get_active_theme(project_root: Path) -> str:
    """Get active theme from .env file."""
    env_file = project_root / '.env'
    if env_file.exists():
        with open(env_file, 'r') as f:
            for line in f:
                if line.startswith('NEXT_PUBLIC_ACTIVE_THEME='):
                    return line.split('=', 1)[1].strip().strip('"\'')
    return 'default'


def prompt_input(prompt: str, default: str = None, choices: list = None) -> str:
    """Prompt user for input with optional default and choices."""
    if choices:
        print(f"\nAvailable options: {', '.join(choices)}")

    if default:
        result = input(f"{prompt} [{default}]: ").strip()
        return result if result else default
    else:
        while True:
            result = input(f"{prompt}: ").strip()
            if result:
                return result
            print("This field is required.")


def validate_slug(slug: str, blocks_dir: Path) -> bool:
    """Validate block slug."""
    if not re.match(r'^[a-z][a-z0-9-]*$', slug):
        print(f"Error: Slug must be kebab-case (lowercase letters, numbers, hyphens)")
        return False

    if (blocks_dir / slug).exists():
        print(f"Error: Block '{slug}' already exists")
        return False

    return True


def generate_config(slug: str, name: str, description: str, category: str, icon: str, scope: list) -> str:
    """Generate config.ts content."""
    scope_str = str(scope).replace("'", '"')
    return f'''import type {{ BlockConfig, BlockCategory }} from '@/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {{
  slug: '{slug}',
  name: '{name}',
  description: '{description}',
  category: '{category}' as BlockCategory,
  icon: '{icon}',
  thumbnail: '/theme/blocks/{slug}/thumbnail.png',
  scope: {scope_str},
}}
'''


def generate_schema(slug: str) -> str:
    """Generate schema.ts content."""
    pascal = to_pascal_case(slug)
    return f'''import {{ z }} from 'zod'
import {{ baseBlockSchema }} from '@/core/types/blocks'

// Extend baseBlockSchema with block-specific fields
// baseBlockSchema already includes: title, content, cta, backgroundColor, className, id
export const schema = baseBlockSchema.merge(z.object({{
  // Add custom fields here
  // Example: items: z.array(itemSchema).optional()
}}))

export type {pascal}Props = z.infer<typeof schema>
'''


def generate_fields(slug: str) -> str:
    """Generate fields.ts content."""
    return '''import type { FieldDefinition } from '@/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@/core/types/blocks'

// Custom content fields
const customContentFields: FieldDefinition[] = [
  // Add custom content fields here
  // Example:
  // {
  //   name: 'subtitle',
  //   label: 'Subtitle',
  //   type: 'text',
  //   tab: 'content',
  // },
]

// Custom design fields
const customDesignFields: FieldDefinition[] = [
  // Add custom design fields here
  // Example:
  // {
  //   name: 'layout',
  //   label: 'Layout',
  //   type: 'select',
  //   tab: 'design',
  //   options: [
  //     { label: 'Left', value: 'left' },
  //     { label: 'Right', value: 'right' },
  //   ],
  // },
]

// CRITICAL: Order matters - content -> design -> advanced
export const fieldDefinitions: FieldDefinition[] = [
  ...baseContentFields,
  ...customContentFields,
  ...baseDesignFields,
  ...customDesignFields,
  ...baseAdvancedFields,  // MUST be last
]

// Compatibility alias
export const fields = fieldDefinitions
'''


def generate_component(slug: str, name: str) -> str:
    """Generate component.tsx content."""
    pascal = to_pascal_case(slug)
    camel = to_camel_case(slug)
    return f'''import {{ buildSectionClasses }} from '@/core/types/blocks'
import {{ sel }} from '../../lib/selectors'
import type {{ {pascal}Props }} from './schema'

export function {pascal}Block({{
  // Base content props (from baseBlockSchema)
  title,
  content,
  cta,
  // Custom props
  // Add destructured custom props here
  // Base design props
  backgroundColor,
  // Base advanced props
  className,
  id,
}}: {pascal}Props) {{
  // Use buildSectionClasses helper (NEVER hardcode colors)
  const sectionClasses = buildSectionClasses('py-16 px-4 md:py-24', {{
    backgroundColor,
    className,
  }})

  return (
    <section
      id={{id}}
      className={{sectionClasses}}
      data-cy={{sel('blocks.{camel}.container')}}
    >
      <div className="container mx-auto">
        {{title && (
          <h2 className="text-3xl font-bold text-center mb-4">{{title}}</h2>
        )}}
        {{content && (
          <div
            className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto"
            dangerouslySetInnerHTML={{{{ __html: content }}}}
          />
        )}}

        {{/* Add custom block content here */}}

        {{cta?.text && cta?.link && (
          <div className="mt-8 text-center">
            <a
              href={{cta.link}}
              target={{cta.target || '_self'}}
              className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              data-cy={{sel('blocks.{camel}.cta')}}
            >
              {{cta.text}}
            </a>
          </div>
        )}}
      </div>
    </section>
  )
}}
'''


def generate_index(slug: str) -> str:
    """Generate index.ts content."""
    pascal = to_pascal_case(slug)
    return f'''export {{ config }} from './config'
export {{ schema }} from './schema'
export {{ fields, fieldDefinitions }} from './fields'
export {{ {pascal}Block as Component }} from './component'

export type {{ {pascal}Props }} from './schema'
'''


def update_selectors(selectors_path: Path, slug: str) -> bool:
    """Add block selectors to BLOCK_SELECTORS."""
    camel = to_camel_case(slug)

    if not selectors_path.exists():
        print(f"Warning: Selectors file not found at {selectors_path}")
        return False

    with open(selectors_path, 'r') as f:
        content = f.read()

    # Check if already exists
    if f"'{camel}':" in content or f'"{camel}":' in content:
        print(f"Selectors for '{camel}' already exist")
        return True

    # Find BLOCK_SELECTORS and add entry
    selector_entry = f'''  {camel}: {{
    container: 'block-{slug}',
  }},'''

    # Find the closing of BLOCK_SELECTORS object
    match = re.search(r'(export const BLOCK_SELECTORS\s*=\s*\{[^}]*)(} as const)', content, re.DOTALL)
    if match:
        new_content = content[:match.end(1)] + '\n' + selector_entry + '\n' + match.group(2) + content[match.end():]
        with open(selectors_path, 'w') as f:
            f.write(new_content)
        print(f"Added selectors for '{camel}' to BLOCK_SELECTORS")
        return True
    else:
        print("Warning: Could not find BLOCK_SELECTORS in selectors file")
        return False


def run_registry_build(project_root: Path) -> bool:
    """Run registry build script."""
    print("\nRebuilding block registry...")
    try:
        result = subprocess.run(
            ['node', 'core/scripts/build/registry.mjs'],
            cwd=project_root,
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print("Registry rebuilt successfully")
            return True
        else:
            print(f"Registry build failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"Error running registry build: {e}")
        return False


def verify_block_in_registry(project_root: Path, slug: str) -> bool:
    """Verify block was added to registry."""
    registry_path = project_root / 'core' / 'lib' / 'registries' / 'block-registry.ts'
    if registry_path.exists():
        with open(registry_path, 'r') as f:
            content = f.read()
        if f"'{slug}':" in content or f'"{slug}":' in content:
            print(f"Block '{slug}' verified in BLOCK_REGISTRY")
            return True
    print(f"Warning: Block '{slug}' not found in BLOCK_REGISTRY")
    return False


def main():
    parser = argparse.ArgumentParser(description='Scaffold a new page builder block')
    parser.add_argument('--theme', help='Theme name (default: from .env)')
    parser.add_argument('--slug', help='Block slug (kebab-case)')
    parser.add_argument('--name', help='Block display name')
    parser.add_argument('--description', help='Block description')
    parser.add_argument('--category', help='Block category', choices=CATEGORIES)
    parser.add_argument('--icon', help='Lucide icon name')
    parser.add_argument('--scope', help='Scope: pages, posts, or both', default='pages')
    args = parser.parse_args()

    project_root = get_project_root()
    print(f"Project root: {project_root}")

    # Check if all required args provided (non-interactive mode)
    non_interactive = all([args.theme or get_active_theme(project_root), args.slug, args.name])

    # Get theme
    theme = args.theme or get_active_theme(project_root)
    if not non_interactive:
        theme = prompt_input("Theme", default=theme)

    blocks_dir = project_root / 'contents' / 'themes' / theme / 'blocks'
    if not blocks_dir.exists():
        print(f"Error: Theme blocks directory not found: {blocks_dir}")
        sys.exit(1)

    # Get block metadata
    if non_interactive:
        slug = to_kebab_case(args.slug)
        if not validate_slug(slug, blocks_dir):
            sys.exit(1)
        name = args.name
        description = args.description or f"{name} block"
        category = args.category or 'content'
        icon = args.icon or 'Box'
        scope_input = args.scope or 'pages'
    else:
        while True:
            slug = args.slug or prompt_input("Block slug (kebab-case)")
            slug = to_kebab_case(slug)
            if validate_slug(slug, blocks_dir):
                break
            args.slug = None  # Reset to prompt again

        name = args.name or prompt_input("Display name", default=to_pascal_case(slug).replace('', ' ').strip())
        description = args.description or prompt_input("Description", default=f"{name} block")

        print(f"\nCategories: {', '.join(CATEGORIES)}")
        category = args.category or prompt_input("Category", default='content', choices=CATEGORIES)

        print(f"\nCommon icons: {', '.join(COMMON_ICONS)}")
        icon = args.icon or prompt_input("Lucide icon", default='Box')

        scope_input = args.scope or prompt_input("Scope (pages, posts, both)", default='pages')

    if category not in CATEGORIES:
        category = 'custom'
    if scope_input == 'both':
        scope = ['pages', 'posts']
    else:
        scope = [scope_input]

    # Create block directory
    block_dir = blocks_dir / slug
    block_dir.mkdir(parents=True, exist_ok=True)
    print(f"\nCreating block at: {block_dir}")

    # Generate files
    files = {
        'config.ts': generate_config(slug, name, description, category, icon, scope),
        'schema.ts': generate_schema(slug),
        'fields.ts': generate_fields(slug),
        'component.tsx': generate_component(slug, name),
        'index.ts': generate_index(slug),
    }

    for filename, content in files.items():
        filepath = block_dir / filename
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"  Created: {filename}")

    # Update selectors
    selectors_path = project_root / 'contents' / 'themes' / theme / 'lib' / 'selectors.ts'
    update_selectors(selectors_path, slug)

    # Run registry build
    run_registry_build(project_root)

    # Verify
    verify_block_in_registry(project_root, slug)

    print(f"\n{'='*50}")
    print(f"Block '{slug}' created successfully!")
    print(f"\nNext steps:")
    print(f"  1. Edit schema.ts to add custom fields")
    print(f"  2. Edit fields.ts to add field definitions")
    print(f"  3. Edit component.tsx to implement rendering")
    print(f"  4. Run: node core/scripts/build/registry.mjs")
    print(f"  5. Test block in page builder")
    print(f"{'='*50}")


if __name__ == '__main__':
    main()
