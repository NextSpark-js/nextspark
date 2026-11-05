import Link from 'next/link'
import { Separator } from '../../ui/separator'
import { useTranslations } from 'next-intl'
import { sel } from '@nextsparkjs/core/selectors/public'
import { APP_NAME, CONSENT_CONFIG } from '../../../lib/config/public-config-client'
import { CookieSettingsLink } from '../../consent/CookieSettingsLink'
import { CurrentYear } from './CurrentYear'

export function PublicFooter() {
  const t = useTranslations('footer')
  const appName = APP_NAME

  // Only the routes core guarantees; a project that wants marketing links writes its own (public)/layout.tsx
  const footerLinks = [{ name: 'docs', href: '/docs' }]

  return (
    <footer className="border-t border-border/40 bg-background" data-cy={sel('public.footer.container')}>
      <div className="container max-w-7xl mx-auto px-4 py-12 md:py-16">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4">{t('resources')}</h3>
          <ul className="space-y-3">
            {footerLinks.map((link) => (
              <li key={link.name}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t(link.name)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <Separator className="my-8" />

        {/* Bottom Section */}
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center space-x-2" data-cy={sel('public.footer.logo')}>
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">{appName.charAt(0)}</span>
            </div>
            <span className="text-sm text-muted-foreground">
              © <CurrentYear /> {appName}. All rights reserved.
            </span>
          </div>

          <div className="flex items-center space-x-6 text-sm text-muted-foreground">
            {CONSENT_CONFIG.enabled && <CookieSettingsLink label={t('cookieSettings')} />}
            <p className="text-center md:text-left">
              Built with ❤️ using{" "}
              <Link
                href="https://nextjs.org"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Next.js
              </Link>
              ,{" "}
              <Link
                href="https://supabase.com"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Supabase
              </Link>
              {" "}and{" "}
              <Link
                href="https://ui.shadcn.com"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-4 hover:text-foreground transition-colors"
              >
                shadcn/ui
              </Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
