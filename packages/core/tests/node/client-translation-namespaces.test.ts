/**
 * Static guard for the RSC message boundary. A literal useTranslations('x.y')
 * serializes top-level namespace `x`; this test makes each rendered location
 * declare the route groups that provide it. A dynamic or bare call is rejected
 * unless this test documents exactly why its provider covers it.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import {
  NAMESPACE_GROUPS,
  getConfiguredClientNamespaces,
  type TranslationGroup,
  selectMessages,
} from '../../src/lib/i18n/client-messages'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const SOURCE_ROOTS = ['apps/dev/src', 'apps/dev/templates', 'packages/core/src', 'plugins']

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === 'dist' ? [] : walk(file)
    return /\.(ts|tsx)$/.test(entry.name) ? [file] : []
  })
}

function renderedGroups(file: string): TranslationGroup[] {
  // A core route module (#203) renders where its app route does: routes/<path> is src/app/<path>.
  const relative = path.relative(ROOT, file).replaceAll(path.sep, '/').replace(/^packages\/core\/src\/routes\//, 'apps/dev/src/app/')
  if (relative.startsWith('apps/dev/src/app/(auth)/')) return ['auth']
  if (relative.startsWith('apps/dev/src/app/dashboard/') || relative.startsWith('apps/dev/templates/dashboard/')) return ['dashboard']
  if (relative.startsWith('apps/dev/src/app/superadmin/') || relative.startsWith('apps/dev/templates/superadmin/')) return ['superadmin']
  if (relative.startsWith('apps/dev/src/app/devtools/')) return ['devtools']
  if (relative.startsWith('apps/dev/src/app/(public)/') || relative.startsWith('apps/dev/templates/(public)/')) return ['public']
  if (relative.includes('/components/app/layouts/')) return ['public']
  if (relative.includes('/components/app/misc/ThemeToggle')) return ['dashboard']
  if (relative.includes('/components/auth/')) return ['auth']
  if (relative.includes('/components/devtools/')) return ['devtools']
  if (relative.includes('/components/docs/')) return ['public']
  if (relative.includes('/components/users/')) return ['superadmin']
  if (relative.includes('/components/app/guards/')) return ['superadmin', 'devtools']
  if (relative.includes('/providers/query-provider')) return ['root']
  if (relative.includes('/components/dashboard/') || relative.includes('/components/billing/') ||
      relative.includes('/components/entities/') || relative.includes('/components/media/') ||
      relative.includes('/components/patterns/') || relative.includes('/components/permissions/') ||
      relative.includes('/components/settings/') || relative.includes('/components/teams/') ||
      relative.includes('/utils/dev/TranslationDebugger') || relative.includes('/hooks/useContentTranslation')) return ['dashboard']
  if (relative.includes('/hooks/useValidationSchemas')) return ['auth', 'dashboard']
  if (relative.startsWith('plugins/langchain/components/observability/')) return ['superadmin']
  return []
}

function parseTranslationSource(file: string, contents = fs.readFileSync(file, 'utf8')): ts.SourceFile {
  return ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function literalNamespaces(file: string): string[] {
  const source = parseTranslationSource(file)
  const namespaces: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useTranslations' && node.arguments.length === 1) {
      const argument = node.arguments[0]
      if (ts.isStringLiteral(argument)) namespaces.push(argument.text.split('.')[0])
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return namespaces
}

function dynamicTranslationCalls(file: string): string[] {
  const source = parseTranslationSource(file)
  const calls: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useTranslations') {
      const [argument] = node.arguments
      if (node.arguments.length !== 1 || !argument || !ts.isStringLiteral(argument)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
        calls.push(`${path.relative(ROOT, file).replaceAll(path.sep, '/')}:${line + 1}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return calls
}

function unallowlistedDynamicCalls(file: string, contents?: string): string[] {
  if (contents !== undefined) {
    const source = parseTranslationSource(file, contents)
    const calls: string[] = []
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'useTranslations') {
        const [argument] = node.arguments
        if (node.arguments.length !== 1 || !argument || !ts.isStringLiteral(argument)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
          calls.push(`${path.relative(ROOT, file).replaceAll(path.sep, '/')}:${line + 1}`)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    return calls.filter((call) => !DYNAMIC_TRANSLATION_ALLOWLIST[call])
  }
  return dynamicTranslationCalls(file).filter((call) => !DYNAMIC_TRANSLATION_ALLOWLIST[call])
}

const DYNAMIC_TRANSLATION_ALLOWLIST: Record<string, { groups: TranslationGroup[], namespaces: string, reason: string }> = {
  'packages/core/src/hooks/useContentTranslation.ts:18': {
    groups: ['dashboard'],
    namespaces: 'every ENTITY_REGISTRY key',
    reason: 'entityName resolves to every registered entity namespace in dashboard.',
  },
  'packages/core/src/hooks/useContentTranslation.ts:119': {
    groups: ['dashboard'],
    namespaces: 'every ENTITY_REGISTRY key',
    reason: 'entityName resolves to every registered entity namespace in dashboard.',
  },
  'packages/core/src/lib/role-helpers.ts:19': {
    groups: ['superadmin'],
    namespaces: 'top-level APP_CONFIG_MERGED.userRoles.displayNames keys',
    reason: 'role display keys resolve from APP_CONFIG_MERGED.userRoles.displayNames.',
  },
  'packages/core/src/components/app/guards/DeveloperGuard.tsx:29': {
    groups: ['devtools'],
    namespaces: 'common',
    reason: 'the guard only reads common.* and devtools provides common.',
  },
  'packages/core/src/components/app/guards/SuperAdminGuard.tsx:29': {
    groups: ['superadmin'],
    namespaces: 'common',
    reason: 'the guard only reads common.* and superadmin provides common.',
  },
  'packages/core/src/components/dashboard/mobile/MobileBottomNav.tsx:29': {
    groups: ['dashboard'],
    namespaces: 'top-level APP_CONFIG_MERGED.mobileNav.items label keys',
    reason: 'mobile navigation label keys resolve from APP_CONFIG_MERGED.mobileNav.items.',
  },
  'packages/core/src/components/dashboard/mobile/MobileMoreSheet.tsx:81': {
    groups: ['dashboard'],
    namespaces: 'top-level APP_CONFIG_MERGED.mobileNav.moreSheetItems label keys',
    reason: 'mobile navigation label keys resolve from APP_CONFIG_MERGED.mobileNav.moreSheetItems.',
  },
}

test('every literal client translation namespace is provided by each rendered route group', () => {
  const unmapped: string[] = []
  const missing: string[] = []

  for (const root of SOURCE_ROOTS) {
    for (const file of walk(path.join(ROOT, root))) {
      const namespaces = literalNamespaces(file)
      if (namespaces.length === 0) continue
      const groups = renderedGroups(file)
      if (groups.length === 0) {
        unmapped.push(path.relative(ROOT, file))
        continue
      }
      for (const group of groups) {
        for (const namespace of namespaces) {
          if (!NAMESPACE_GROUPS[group].includes(namespace as never)) {
            missing.push(`${path.relative(ROOT, file)}: ${namespace} missing from ${group}`)
          }
        }
      }
    }
  }

  assert.deepEqual(unmapped, [], `map this client component to its route group:\n${unmapped.join('\n')}`)
  assert.deepEqual(missing, [], `add the namespace to the rendered group:\n${missing.join('\n')}`)
})

test('every dynamic or bare client translation call has an explicit, documented provider rule', () => {
  const unallowlisted: string[] = []
  const staleAllowlist = new Set(Object.keys(DYNAMIC_TRANSLATION_ALLOWLIST))

  for (const root of SOURCE_ROOTS) {
    for (const file of walk(path.join(ROOT, root))) {
      for (const call of dynamicTranslationCalls(file)) {
        staleAllowlist.delete(call)
        if (!DYNAMIC_TRANSLATION_ALLOWLIST[call]) unallowlisted.push(call)
      }
    }
  }

  assert.deepEqual(unallowlisted, [], `add a one-line justification and provider rule:\n${unallowlisted.join('\n')}`)
  assert.deepEqual([...staleAllowlist], [], `remove or update stale dynamic-call allowlist entries:\n${[...staleAllowlist].join('\n')}`)
  for (const [call, entry] of Object.entries(DYNAMIC_TRANSLATION_ALLOWLIST)) {
    assert.ok(entry.namespaces.length > 0 && entry.reason.length > 0, `${call} must declare its namespaces and justification`)
  }
})

test('the dynamic-call guard rejects a newly introduced client call', () => {
  const file = path.join(ROOT, 'packages/core/src/components/test/Mutation.tsx')
  assert.deepEqual(
    unallowlistedDynamicCalls(file, "'use client'\nconst t = useTranslations(namespace)\n"),
    ['packages/core/src/components/test/Mutation.tsx:2'],
  )
})

test('selection retains only a route group and explicitly requested template namespaces', () => {
  const messages = { common: { ok: 'OK' }, customBlog: { title: 'Blog' }, unrelated: { value: 'nope' } }
  assert.deepEqual(selectMessages(messages, 'public'), { common: { ok: 'OK' } })
  assert.deepEqual(selectMessages(messages, 'auth', ['customBlog']), { common: { ok: 'OK' }, customBlog: { title: 'Blog' } })
})

test('dashboard includes every registered entity namespace and superadmin includes configured role namespaces', () => {
  const configured = getConfiguredClientNamespaces({
    entityRegistry: { widgets: {}, invoices: {} },
    appConfig: {
      userRoles: { displayNames: { auditor: 'customRoles.auditor', member: 'common.userRoles.member' } },
      mobileNav: {
        items: [{ labelKey: 'workspace.navigation.home' }],
        moreSheetItems: [{ labelKey: 'workspace.navigation.settings' }],
      },
    },
  })
  const messages = {
    widgets: { title: 'Widgets' },
    invoices: { title: 'Invoices' },
    customRoles: { auditor: 'Auditor' },
    workspace: { navigation: { home: 'Home', settings: 'Settings' } },
  }

  assert.deepEqual(selectMessages(messages, 'dashboard', configured.dashboard), {
    widgets: { title: 'Widgets' },
    invoices: { title: 'Invoices' },
    workspace: { navigation: { home: 'Home', settings: 'Settings' } },
  })
  assert.deepEqual(selectMessages(messages, 'superadmin', configured.superadmin), {
    customRoles: { auditor: 'Auditor' },
  })
})
