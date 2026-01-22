/**
 * Entity Layout (Dynamic Routes Fallback)
 *
 * This layout handles dynamic entity routes that don't have specific template pages.
 *
 * IMPORTANT: Permission checking is now handled by the parent layout at:
 * app/dashboard/(main)/layout.tsx
 *
 * This ensures permissions are checked for ALL routes, including:
 * - Template routes (e.g., /dashboard/ai-agents/create with specific page.tsx)
 * - Dynamic routes (e.g., /dashboard/[entity]/create fallback)
 *
 * Previously, permission checking was here but it never executed for template routes
 * because Next.js route specificity gives priority to explicit paths over dynamic ones.
 */

interface EntityLayoutProps {
  children: React.ReactNode
  params: Promise<{ entity: string }>
}

export default async function EntityLayout({
  children
}: EntityLayoutProps) {
  // Permission checking handled by parent (main)/layout.tsx
  return <>{children}</>
}
