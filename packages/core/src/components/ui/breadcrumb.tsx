import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import Link from "next/link"
import { cn } from '../../lib/utils'
import { withBasePathIfInApp } from '../../lib/base-path'
import { ChevronRightIcon, DotsHorizontalIcon } from "@radix-ui/react-icons"

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<"nav"> & {
    separator?: React.ReactNode
  }
>(({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />)
Breadcrumb.displayName = "Breadcrumb"

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<"ol">
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
      className
    )}
    {...props}
  />
))
BreadcrumbList.displayName = "BreadcrumbList"

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("inline-flex items-center gap-1.5", className)}
    {...props}
  />
))
BreadcrumbItem.displayName = "BreadcrumbItem"

/**
 * A breadcrumb's link, with the base path on an in-app `href`: Next.js adds it
 * to a <Link> and not to an <a>.
 *
 * With `asChild` the props go to the child, and a child `href` of its own wins
 * over the link's. An <a> child gets the base path on whichever of the two it
 * ends up with. A <Link> child puts the base path on by itself, so it gets the
 * link's href as written; given it with the base path already on, it would put
 * it on twice. Any other child gets the link's href with the base path on and
 * keeps an href of its own untouched, since what it renders is not known here:
 * a component that wraps <Link> and takes its href from the link puts the base
 * path on twice.
 */
const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<"a"> & {
    asChild?: boolean
  }
>(({ asChild, className, href, children, ...props }, ref) => {
  const linkClassName = cn("transition-colors hover:text-foreground", className)

  if (!asChild) {
    return (
      <a ref={ref} className={linkClassName} {...props} href={href && withBasePathIfInApp(href)}>
        {children}
      </a>
    )
  }

  const child = React.isValidElement<React.ComponentPropsWithoutRef<"a">>(children) ? children : undefined
  const slotProps = { ...props, href: child?.type === Link ? href : href && withBasePathIfInApp(href) }

  return (
    <Slot ref={ref} className={linkClassName} {...slotProps}>
      {child?.type === "a" && typeof child.props.href === "string"
        ? React.cloneElement(child, { href: withBasePathIfInApp(child.props.href) })
        : children}
    </Slot>
  )
})
BreadcrumbLink.displayName = "BreadcrumbLink"

const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn("font-normal text-foreground", className)}
    {...props}
  />
))
BreadcrumbPage.displayName = "BreadcrumbPage"

const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) => (
  <li
    role="presentation"
    aria-hidden="true"
    className={cn("[&>svg]:w-3.5 [&>svg]:h-3.5", className)}
    {...props}
  >
    {children ?? <ChevronRightIcon />}
  </li>
)
BreadcrumbSeparator.displayName = "BreadcrumbSeparator"

const BreadcrumbEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <DotsHorizontalIcon className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
)
BreadcrumbEllipsis.displayName = "BreadcrumbElipssis"

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}
