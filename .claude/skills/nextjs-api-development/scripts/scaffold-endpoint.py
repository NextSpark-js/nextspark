#!/usr/bin/env python3
"""
Scaffold API Endpoint Script

Creates the file structure for a new API endpoint following Next.js 15 App Router patterns.

Usage:
    python scaffold-endpoint.py --name ENDPOINT_NAME [--methods METHODS] [--auth AUTH_TYPE]

Options:
    --name ENDPOINT_NAME   Name of the endpoint (kebab-case)
    --methods METHODS      Comma-separated HTTP methods (default: GET,POST)
    --auth AUTH_TYPE       Authentication type: required, optional, none (default: required)
    --override             Create in (contents)/ folder for custom logic
    --with-id              Include [id] route for single resource operations
"""

import os
import sys
import argparse
from pathlib import Path
from datetime import datetime


def to_camel_case(name: str) -> str:
    """Convert kebab-case to camelCase."""
    components = name.split('-')
    return components[0] + ''.join(x.title() for x in components[1:])


def to_pascal_case(name: str) -> str:
    """Convert kebab-case to PascalCase."""
    return ''.join(x.title() for x in name.split('-'))


def to_snake_case(name: str) -> str:
    """Convert kebab-case to snake_case."""
    return name.replace('-', '_')


def generate_list_route(name: str, methods: list, auth_type: str) -> str:
    """Generate list/create route file."""
    pascal = to_pascal_case(name)
    singular = name.rstrip('s')
    methods_str = ', '.join(methods)

    # Build imports
    imports = [
        "import { NextRequest, NextResponse } from 'next/server'",
        "import { queryWithRLS, mutateWithRLS } from '@/core/lib/db'",
    ]

    helper_imports = [
        "createApiResponse",
        "createApiError",
        "withApiLogging",
        "handleCorsPreflightRequest",
        "addCorsHeaders",
    ]
    if 'GET' in methods:
        helper_imports.extend(["createPaginationMeta", "parsePaginationParams"])

    imports.append(f"import {{ {', '.join(helper_imports)} }} from '@/core/lib/api/helpers'")

    if auth_type == 'required':
        imports.append("import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'")

    if 'POST' in methods or 'PATCH' in methods:
        imports.append("import { z } from 'zod'")

    # Build endpoint comments
    endpoint_lines = []
    for m in methods:
        endpoint_lines.append(f" * {m} /api/v1/{name}")

    code = f'''/**
 * {pascal} API Route
 *
 * Handles list and create operations for {name}.
 *
 * Endpoints:
{chr(10).join(endpoint_lines)}
 */

{chr(10).join(imports)}
'''

    # Add schema if POST
    if 'POST' in methods:
        code += f'''
// Validation schema for creating {singular}
const Create{pascal}Schema = z.object({{
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  // Add more fields as needed
}})
'''

    # OPTIONS handler
    code += '''
// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}
'''

    # GET handler
    if 'GET' in methods:
        code += f'''
// GET /api/v1/{name} - List {name}
export const GET = withApiLogging(async (req: NextRequest): Promise<NextResponse> => {{
  try {{
'''
        if auth_type == 'required':
            code += '''    // Authenticate using dual auth
    const authResult = await authenticateRequest(req)

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
        { status: 401 }
      )
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse
    }

'''
        code += f'''    const {{ page, limit, offset }} = parsePaginationParams(req)

    // TODO: Implement data fetching with queryWithRLS
    const data: unknown[] = []
    const total = 0

    const paginationMeta = createPaginationMeta(page, limit, total)
    const response = createApiResponse(data, paginationMeta)
    return addCorsHeaders(response)
  }} catch (error) {{
    console.error('[{name.upper()}] List error:', error)
    const response = createApiError('Failed to fetch {name}', 500)
    return addCorsHeaders(response)
  }}
}})
'''

    # POST handler
    if 'POST' in methods:
        code += f'''
// POST /api/v1/{name} - Create {singular}
export const POST = withApiLogging(async (req: NextRequest): Promise<NextResponse> => {{
  try {{
'''
        if auth_type == 'required':
            code += '''    // Authenticate using dual auth
    const authResult = await authenticateRequest(req)

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
        { status: 401 }
      )
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse
    }

'''
        code += f'''    // Validate input
    const body = Create{pascal}Schema.parse(await req.json())

    // TODO: Implement creation with mutateWithRLS
    const created = {{ id: 'new-id', ...body }}

    const response = createApiResponse(created, {{ created: true }}, 201)
    return addCorsHeaders(response)
  }} catch (error) {{
    if (error instanceof z.ZodError) {{
      const response = createApiError('Validation error', 400, error.issues, 'VALIDATION_ERROR')
      return addCorsHeaders(response)
    }}
    console.error('[{name.upper()}] Create error:', error)
    const response = createApiError('Failed to create {singular}', 500)
    return addCorsHeaders(response)
  }}
}})
'''

    return code


def generate_id_route(name: str, methods: list, auth_type: str) -> str:
    """Generate single resource route file."""
    pascal = to_pascal_case(name)
    singular = name.rstrip('s')

    # Build imports
    imports = [
        "import { NextRequest, NextResponse } from 'next/server'",
        "import { queryWithRLS, mutateWithRLS } from '@/core/lib/db'",
    ]

    helper_imports = [
        "createApiResponse",
        "createApiError",
        "withApiLogging",
        "handleCorsPreflightRequest",
        "addCorsHeaders",
    ]

    imports.append(f"import {{ {', '.join(helper_imports)} }} from '@/core/lib/api/helpers'")

    if auth_type == 'required':
        imports.append("import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'")

    if 'PATCH' in methods:
        imports.append("import { z } from 'zod'")

    code = f'''/**
 * {pascal} Single Resource API Route
 *
 * Handles read, update, and delete operations for a single {singular}.
 *
 * Endpoints:
 * GET    /api/v1/{name}/[id]
 * PATCH  /api/v1/{name}/[id]
 * DELETE /api/v1/{name}/[id]
 */

{chr(10).join(imports)}

interface RouteParams {{
  params: Promise<{{ id: string }}>
}}
'''

    # Add schema if PATCH
    if 'PATCH' in methods:
        code += f'''
// Validation schema for updating {singular}
const Update{pascal}Schema = z.object({{
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  // Add more fields as needed
}}).partial()
'''

    # OPTIONS handler
    code += '''
// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}
'''

    # GET handler
    if 'GET' in methods:
        code += f'''
// GET /api/v1/{name}/[id] - Get single {singular}
export const GET = withApiLogging(async (
  req: NextRequest,
  {{ params }}: RouteParams
): Promise<NextResponse> => {{
  const {{ id }} = await params

  try {{
'''
        if auth_type == 'required':
            code += '''    // Authenticate using dual auth
    const authResult = await authenticateRequest(req)

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
        { status: 401 }
      )
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse
    }

'''
        code += f'''    // TODO: Implement fetching by ID with queryWithRLS
    const data = {{ id }}

    if (!data) {{
      const response = createApiError('{singular.title()} not found', 404)
      return addCorsHeaders(response)
    }}

    const response = createApiResponse(data)
    return addCorsHeaders(response)
  }} catch (error) {{
    console.error('[{name.upper()}] Get error:', error)
    const response = createApiError('Failed to fetch {singular}', 500)
    return addCorsHeaders(response)
  }}
}})
'''

    # PATCH handler
    if 'PATCH' in methods:
        code += f'''
// PATCH /api/v1/{name}/[id] - Update {singular}
export const PATCH = withApiLogging(async (
  req: NextRequest,
  {{ params }}: RouteParams
): Promise<NextResponse> => {{
  const {{ id }} = await params

  try {{
'''
        if auth_type == 'required':
            code += '''    // Authenticate using dual auth
    const authResult = await authenticateRequest(req)

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
        { status: 401 }
      )
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse
    }

'''
        code += f'''    // Validate input
    const body = Update{pascal}Schema.parse(await req.json())

    // TODO: Implement update with mutateWithRLS
    const updated = {{ id, ...body }}

    const response = createApiResponse(updated)
    return addCorsHeaders(response)
  }} catch (error) {{
    if (error instanceof z.ZodError) {{
      const response = createApiError('Validation error', 400, error.issues, 'VALIDATION_ERROR')
      return addCorsHeaders(response)
    }}
    console.error('[{name.upper()}] Update error:', error)
    const response = createApiError('Failed to update {singular}', 500)
    return addCorsHeaders(response)
  }}
}})
'''

    # DELETE handler
    if 'DELETE' in methods:
        code += f'''
// DELETE /api/v1/{name}/[id] - Delete {singular}
export const DELETE = withApiLogging(async (
  req: NextRequest,
  {{ params }}: RouteParams
): Promise<NextResponse> => {{
  const {{ id }} = await params

  try {{
'''
        if auth_type == 'required':
            code += '''    // Authenticate using dual auth
    const authResult = await authenticateRequest(req)

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
        { status: 401 }
      )
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse
    }

'''
        code += f'''    // TODO: Implement delete with mutateWithRLS

    const response = createApiResponse({{ deleted: true, id }})
    return addCorsHeaders(response)
  }} catch (error) {{
    console.error('[{name.upper()}] Delete error:', error)
    const response = createApiError('Failed to delete {singular}', 500)
    return addCorsHeaders(response)
  }}
}})
'''

    return code


def main():
    parser = argparse.ArgumentParser(description='Scaffold API endpoint')
    parser.add_argument('--name', required=True, help='Endpoint name (kebab-case)')
    parser.add_argument('--methods', default='GET,POST', help='HTTP methods (comma-separated)')
    parser.add_argument('--auth', choices=['required', 'optional', 'none'], default='required')
    parser.add_argument('--override', action='store_true', help='Create in (contents)/ folder')
    parser.add_argument('--with-id', action='store_true', help='Include [id] route')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be created')

    args = parser.parse_args()

    name = args.name.lower()
    methods = [m.strip().upper() for m in args.methods.split(',')]

    # Determine base path
    if args.override:
        base_path = Path(f'app/api/v1/(contents)/{name}')
    else:
        base_path = Path(f'app/api/v1/{name}')

    print(f"\n{'=' * 60}")
    print(f"SCAFFOLDING API ENDPOINT: {name}")
    print(f"{'=' * 60}")
    print(f"Methods: {', '.join(methods)}")
    print(f"Auth: {args.auth}")
    print(f"Override: {args.override}")
    print(f"Path: {base_path}")
    print(f"{'=' * 60}\n")

    # Files to create
    files = {
        'route.ts': generate_list_route(name, methods, args.auth)
    }

    # Add [id] route if requested
    if args.with_id:
        id_methods = []
        if 'GET' in methods:
            id_methods.append('GET')
        if 'POST' in methods or 'PUT' in methods or 'PATCH' in methods:
            id_methods.append('PATCH')
        if 'DELETE' in methods:
            id_methods.append('DELETE')

        files['[id]/route.ts'] = generate_id_route(name, id_methods, args.auth)

    if args.dry_run:
        print("DRY RUN - Files that would be created:\n")
        for file_path, content in files.items():
            print(f"  {base_path / file_path}")
            print(f"    Lines: {len(content.splitlines())}")
        print("\n" + "-" * 60)
        print("GENERATED CODE PREVIEW (route.ts):")
        print("-" * 60)
        print(files['route.ts'])
        print("-" * 60)
        print("\nRun without --dry-run to create files.")
        return 0

    # Create files
    for file_path, content in files.items():
        full_path = base_path / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)

        if full_path.exists():
            print(f"  SKIP (exists): {full_path}")
        else:
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  CREATED: {full_path}")

    print(f"\n{'=' * 60}")
    print("NEXT STEPS:")
    print("=" * 60)
    print(f"1. Implement TODO sections in route files")
    print(f"2. Add API scopes to core/lib/api/keys.ts:")
    print(f"   '{name}:read': 'Read {name}',")
    print(f"   '{name}:write': 'Create/update {name}',")
    print(f"   '{name}:delete': 'Delete {name}',")
    print(f"3. Create Cypress tests for the endpoint")
    print(f"4. Test with both API key and session auth")
    print("=" * 60 + "\n")

    return 0


if __name__ == '__main__':
    sys.exit(main())
