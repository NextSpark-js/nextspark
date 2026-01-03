import { redirect } from 'next/navigation'
import { getTemplateOrDefault } from "@nextsparkjs/core/lib/template-resolver"

/**
 * Default Public Home Page (CORE)
 *
 * This is the minimal CORE version that redirects to dashboard if no theme template override exists.
 * Theme templates can override this to provide custom landing pages.
 *
 * Location: app/(public)/page.tsx (CORE)
 * Override: contents/themes/[theme]/templates/(public)/page.tsx (THEME)
 */
function DefaultPublicHome() {
  // Si no hay template override, redirect to dashboard
  // (Theme provides the actual landing page)
  redirect('/dashboard')
}

export default getTemplateOrDefault('app/(public)/page.tsx', DefaultPublicHome)
