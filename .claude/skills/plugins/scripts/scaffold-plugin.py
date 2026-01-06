#!/usr/bin/env python3
"""
Scaffold Plugin Script

Creates a new plugin with complete file structure.
Part of the plugins skill.

Usage:
    python scaffold-plugin.py --name "my-plugin" --type service
    python scaffold-plugin.py -n "analytics" -t utility --features "hooks,api"
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path


def get_project_root() -> Path:
    """Find the project root by looking for .claude directory."""
    current = Path(__file__).resolve()

    for parent in current.parents:
        if (parent / ".claude").is_dir():
            return parent

    cwd = Path.cwd()
    if (cwd / ".claude").is_dir():
        return cwd

    print("Error: Could not find project root (.claude directory)")
    sys.exit(1)


def validate_name(name: str) -> str:
    """Validate and normalize plugin name."""
    normalized = name.lower().strip().replace(" ", "-").replace("_", "-")
    cleaned = "".join(c for c in normalized if c.isalnum() or c == "-")

    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")

    cleaned = cleaned.strip("-")

    if not cleaned:
        print("Error: Invalid plugin name. Must contain alphanumeric characters.")
        sys.exit(1)

    return cleaned


def to_pascal_case(name: str) -> str:
    """Convert kebab-case to PascalCase."""
    return "".join(word.capitalize() for word in name.split("-"))


def to_camel_case(name: str) -> str:
    """Convert kebab-case to camelCase."""
    pascal = to_pascal_case(name)
    return pascal[0].lower() + pascal[1:] if pascal else ""


def to_upper_snake(name: str) -> str:
    """Convert kebab-case to UPPER_SNAKE_CASE."""
    return name.replace("-", "_").upper()


def create_plugin(name: str, plugin_type: str, features: list) -> None:
    """Create a new plugin with complete file structure."""
    project_root = get_project_root()
    plugins_dir = project_root / "contents" / "plugins"
    plugin_name = validate_name(name)
    plugin_path = plugins_dir / plugin_name

    if plugin_path.exists():
        print(f"Error: Plugin already exists: {plugin_path}")
        sys.exit(1)

    plugin_path.mkdir(parents=True, exist_ok=True)
    print(f"Created plugin: {plugin_name}")

    # Naming variants
    P = to_pascal_case(plugin_name)  # PascalCase
    c = to_camel_case(plugin_name)   # camelCase
    U = to_upper_snake(plugin_name)  # UPPER_SNAKE

    created_files = []

    # 1. plugin.config.ts
    config_content = f"""import {{ z }} from 'zod'
import type {{ PluginConfig }} from '@/core/types/plugin'

const {P}ConfigSchema = z.object({{
  enabled: z.boolean().default(true),
  debugMode: z.boolean().default(false),
  timeout: z.number().min(1000).max(60000).default(5000)
}})

export const {c}Config: PluginConfig = {{
  name: '{plugin_name}',
  version: '1.0.0',
  displayName: '{P}',
  description: '{P} plugin for the application',
  enabled: true,
  dependencies: [],
  components: {{ {P}Widget: undefined }},
  services: {{ use{P}: undefined }},
  hooks: {{
    async onLoad() {{ console.log('[{P}] Loading...') }},
    async onActivate() {{ console.log('[{P}] Activated') }},
    async onDeactivate() {{ console.log('[{P}] Deactivated') }},
    async onUnload() {{ console.log('[{P}] Unloaded') }}
  }}
}}

export default {c}Config
"""
    (plugin_path / "plugin.config.ts").write_text(config_content)
    created_files.append("plugin.config.ts")

    # 2. README.md
    readme_content = f"""# {P} Plugin

## Overview

{P} plugin for the application.

## Installation

Automatically registered when placed in `contents/plugins/{plugin_name}/`.

## Configuration

```bash
{U}_ENABLED=true
{U}_DEBUG=false
```

## Usage

```typescript
import {{ use{P} }} from '@/contents/plugins/{plugin_name}/hooks/use{P}'

function MyComponent() {{
  const {{ data, isLoading }} = use{P}()
}}
```

## API Endpoints

- `POST /api/plugin/{plugin_name}/process` - Process data

## Components

- `{P}Widget` - Main widget component
"""
    (plugin_path / "README.md").write_text(readme_content)
    created_files.append("README.md")

    # 3. .env.example
    env_content = f"""# {U} PLUGIN ENVIRONMENT VARIABLES
# Only {U}_* namespaced variables here
# Global variables go in root .env

{U}_ENABLED=true
{U}_DEBUG=false
{U}_TIMEOUT=5000
"""
    (plugin_path / ".env.example").write_text(env_content)
    created_files.append(".env.example")

    # 4. package.json
    package_content = f"""{{
  "name": "@plugins/{plugin_name}",
  "version": "1.0.0",
  "private": true,
  "description": "{P} plugin",
  "main": "plugin.config.ts"
}}
"""
    (plugin_path / "package.json").write_text(package_content)
    created_files.append("package.json")

    # 5. tsconfig.json
    tsconfig_content = """{
  "extends": "../../../tsconfig.json",
  "compilerOptions": { "rootDir": ".", "outDir": "./dist" },
  "include": ["./**/*.ts", "./**/*.tsx"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
"""
    (plugin_path / "tsconfig.json").write_text(tsconfig_content)
    created_files.append("tsconfig.json")

    # 6. types/
    types_dir = plugin_path / "types"
    types_dir.mkdir(exist_ok=True)
    types_content = f"""export interface {P}Config {{
  readonly enabled: boolean
  readonly debugMode: boolean
  readonly timeout: number
}}

export interface {P}Input {{
  readonly data: string
  readonly options?: {P}Options
}}

export interface {P}Output<T = unknown> {{
  readonly success: boolean
  readonly data?: T
  readonly error?: string
  readonly metadata: {{ readonly processingTime: number; readonly timestamp: string }}
}}

export interface {P}Options {{
  readonly timeout?: number
}}
"""
    (types_dir / f"{plugin_name}.types.ts").write_text(types_content)
    created_files.append(f"types/{plugin_name}.types.ts")

    # 7. lib/
    lib_dir = plugin_path / "lib"
    lib_dir.mkdir(exist_ok=True)
    lib_content = f"""import type {{ {P}Config, {P}Input, {P}Output }} from '../types/{plugin_name}.types'

export class {P}Core {{
  private config: {P}Config
  private initialized = false

  constructor(config: {P}Config) {{ this.config = config }}

  async initialize(): Promise<void> {{
    if (this.initialized) return
    await this.validateConfiguration()
    this.initialized = true
    console.log('[{P}] Initialized')
  }}

  private async validateConfiguration(): Promise<void> {{
    if (!this.config.enabled) throw new Error('{P} plugin is disabled')
  }}

  async process(input: {P}Input): Promise<{P}Output> {{
    if (!this.initialized) await this.initialize()
    const startTime = Date.now()
    try {{
      const result = {{ processed: input.data }}
      return {{
        success: true,
        data: result,
        metadata: {{ processingTime: Date.now() - startTime, timestamp: new Date().toISOString() }}
      }}
    }} catch (error) {{
      return {{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {{ processingTime: Date.now() - startTime, timestamp: new Date().toISOString() }}
      }}
    }}
  }}
}}
"""
    (lib_dir / "core.ts").write_text(lib_content)
    created_files.append("lib/core.ts")

    # 8. hooks/ (if service type or requested)
    if "hooks" in features or plugin_type == "service":
        hooks_dir = plugin_path / "hooks"
        hooks_dir.mkdir(exist_ok=True)
        hook_content = f"""'use client'

import {{ useQuery, useMutation, useQueryClient }} from '@tanstack/react-query'
import type {{ {P}Input, {P}Output }} from '../types/{plugin_name}.types'

const QUERY_KEY = ['{plugin_name}'] as const

export function use{P}() {{
  return useQuery({{
    queryKey: QUERY_KEY,
    queryFn: async () => {{
      const response = await fetch('/api/plugin/{plugin_name}/data')
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    }}
  }})
}}

export function use{P}Mutation() {{
  const queryClient = useQueryClient()
  return useMutation({{
    mutationFn: async (input: {P}Input) => {{
      const response = await fetch('/api/plugin/{plugin_name}/process', {{
        method: 'POST',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify(input)
      }})
      if (!response.ok) throw new Error('Failed to process')
      return response.json() as Promise<{P}Output>
    }},
    onSuccess: () => {{ queryClient.invalidateQueries({{ queryKey: QUERY_KEY }}) }}
  }})
}}
"""
        (hooks_dir / f"use{P}.ts").write_text(hook_content)
        created_files.append(f"hooks/use{P}.ts")

    # 9. components/ (if service type or requested)
    if "components" in features or plugin_type == "service":
        components_dir = plugin_path / "components"
        components_dir.mkdir(exist_ok=True)
        component_content = f"""'use client'

import {{ Card, CardHeader, CardContent }} from '@/core/components/ui/card'
import {{ Button }} from '@/core/components/ui/button'
import {{ use{P} }} from '../hooks/use{P}'

interface {P}WidgetProps {{
  readonly title?: string
  readonly onAction?: () => void
}}

export function {P}Widget({{ title = '{P}', onAction }}: {P}WidgetProps) {{
  const {{ data, isLoading, error }} = use{P}()

  return (
    <Card data-cy="{plugin_name}-widget">
      <CardHeader><h3>{{title}}</h3></CardHeader>
      <CardContent>
        {{isLoading && <div data-cy="{plugin_name}-loading">Loading...</div>}}
        {{error && <div data-cy="{plugin_name}-error">{{error.message}}</div>}}
        {{data && <div data-cy="{plugin_name}-content">{{/* Content */}}</div>}}
        <Button data-cy="{plugin_name}-action-btn" onClick={{onAction}}>Action</Button>
      </CardContent>
    </Card>
  )
}}
"""
        (components_dir / f"{P}Widget.tsx").write_text(component_content)
        created_files.append(f"components/{P}Widget.tsx")

    # 10. api/ (if service type or requested)
    if "api" in features or plugin_type == "service":
        api_dir = plugin_path / "api" / "process"
        api_dir.mkdir(parents=True, exist_ok=True)
        api_content = f"""import {{ NextRequest, NextResponse }} from 'next/server'
import {{ z }} from 'zod'
import {{ authenticateRequest }} from '@/core/lib/auth/authenticateRequest'
import {{ {P}Core }} from '../../lib/core'

const ProcessInputSchema = z.object({{
  data: z.string().min(1).max(10000),
  options: z.object({{ timeout: z.number().min(1000).max(30000).optional() }}).optional()
}})

export async function POST(request: NextRequest) {{
  try {{
    const auth = await authenticateRequest(request)
    if (!auth.isAuthenticated) {{
      return NextResponse.json({{ success: false, error: 'Unauthorized' }}, {{ status: 401 }})
    }}

    const body = await request.json()
    const input = ProcessInputSchema.parse(body)

    const core = new {P}Core({{ enabled: true, debugMode: false, timeout: input.options?.timeout || 5000 }})
    const result = await core.process(input)

    return NextResponse.json(result)
  }} catch (error) {{
    if (error instanceof z.ZodError) {{
      return NextResponse.json({{ success: false, error: 'Validation error', details: error.errors }}, {{ status: 400 }})
    }}
    console.error('[{P}] API Error:', error)
    return NextResponse.json({{ success: false, error: 'Internal server error' }}, {{ status: 500 }})
  }}
}}
"""
        (api_dir / "route.ts").write_text(api_content)
        created_files.append("api/process/route.ts")

    # 11. docs/
    docs_dir = plugin_path / "docs" / "01-getting-started"
    docs_dir.mkdir(parents=True, exist_ok=True)
    intro_content = f"""# {P} Plugin

## Introduction

{P} is a plugin that provides functionality for the application.

## Quick Start

```typescript
import {{ use{P} }} from '@/contents/plugins/{plugin_name}/hooks/use{P}'

function MyComponent() {{
  const {{ data, isLoading }} = use{P}()
  if (isLoading) return <div>Loading...</div>
  return <div>{{data}}</div>
}}
```
"""
    (docs_dir / "01-introduction.md").write_text(intro_content)
    created_files.append("docs/01-getting-started/01-introduction.md")

    # Summary
    print(f"\nPlugin created with {len(created_files)} files:")
    for file in created_files:
        print(f"  {file}")

    print(f"\nPlugin path: {plugin_path}")
    print("\nNext steps:")
    print("  1. Configure environment variables")
    print("  2. Implement core logic in lib/core.ts")
    print("  3. Run: node core/scripts/build/registry.mjs")
    print("  4. Test with: pnpm build")


def main():
    parser = argparse.ArgumentParser(
        description="Create a new plugin with complete file structure",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scaffold-plugin.py --name "my-plugin" --type service
  python scaffold-plugin.py -n "analytics" -t utility
  python scaffold-plugin.py --name "payment" --type service --features "components,hooks,api"
        """
    )

    parser.add_argument("-n", "--name", required=True, help="Plugin name (kebab-case)")
    parser.add_argument("-t", "--type", choices=["utility", "service", "configuration"], default="service", help="Plugin type (default: service)")
    parser.add_argument("-f", "--features", default="", help="Comma-separated: components,hooks,api")

    args = parser.parse_args()
    features = [f.strip() for f in args.features.split(",") if f.strip()]
    create_plugin(args.name, args.type, features)


if __name__ == "__main__":
    main()
