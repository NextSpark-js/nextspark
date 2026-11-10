import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface DocsBreadcrumbsProps {
  items: BreadcrumbItem[]
  /** The accessible name of the nav, in the language of the page. */
  label: string
}

export function DocsBreadcrumbs({ items, label }: DocsBreadcrumbsProps) {
  return (
    <nav
      aria-label={label}
      className="flex items-center space-x-2 text-sm"
      data-cy="docs-breadcrumbs"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <div key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight
                className="h-4 w-4 mx-2 text-muted-foreground"
                aria-hidden="true"
              />
            )}

            {isLast || !item.href ? (
              <span
                className="text-foreground font-medium"
                aria-current="page"
                data-cy={`breadcrumb-${index}`}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                data-cy={`breadcrumb-link-${index}`}
              >
                {item.label}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
