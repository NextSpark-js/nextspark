import Link from 'next/link'
import { Separator } from '../../ui/separator'
import { useTranslations } from 'next-intl'
import { sel } from '../../../lib/test'

export function PublicFooter() {
  const currentYear = new Date().getFullYear()
  const t = useTranslations('footer')

  const footerLinks = {
    product: [
      { name: 'features', href: '/features' },
      { name: 'pricing', href: '/pricing' },
      { name: 'support', href: '/support' },
      { name: 'docs', href: '/docs' }
    ],
    company: [
      { name: 'about', href: '/about' },
      { name: 'blog', href: '/blog' },
      { name: 'careers', href: '/careers' },
      { name: 'contact', href: '/contact' }
    ],
    legal: [
      { name: 'privacy', href: '/legal/privacy' },
      { name: 'terms', href: '/legal/terms' },
      { name: 'cookies', href: '/legal/cookies' },
      { name: 'gdpr', href: '/legal/gdpr' }
    ],
    resources: [
      { name: 'helpCenter', href: '/support' },
      { name: 'apiDocs', href: '/docs/api' },
      { name: 'status', href: '/status' },
      { name: 'changelog', href: '/changelog' }
    ]
  }

  return (
    <footer className="border-t border-border/40 bg-background" data-cy={sel('public.footer.container')}>
      <div className="container max-w-7xl mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">{t('product')}</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
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

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">{t('company')}</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
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

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">{t('legal')}</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
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

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">{t('resources')}</h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
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
        </div>

        <Separator className="my-8" />

        {/* Bottom Section */}
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center space-x-2" data-cy={sel('public.footer.logo')}>
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">B</span>
            </div>
            <span className="text-sm text-muted-foreground">
              © {currentYear} Boilerplate. All rights reserved.
            </span>
          </div>

          <div className="flex items-center space-x-6 text-sm text-muted-foreground">
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
