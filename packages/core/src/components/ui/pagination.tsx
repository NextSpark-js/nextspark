"use client"

import * as React from "react"
import { cn } from '../../lib/utils'
import { withBasePathIfInApp } from '../../lib/base-path'
import { useCommonText } from '../../lib/i18n/common-text'
import { buttonVariants } from './button'
import { ChevronLeftIcon, ChevronRightIcon, DotsHorizontalIcon } from "@radix-ui/react-icons"

/*
 * The accessible names default to the active locale's `common.a11y` messages, or English with no
 * `NextIntlClientProvider`. `aria-label` sets the name of Pagination, PaginationPrevious and PaginationNext per use,
 * and `moreLabel` the one of PaginationEllipsis.
 */
const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => {
  const label = useCommonText('a11y', 'pagination', 'Pagination')
  return (
    <nav
      role="navigation"
      aria-label={label}
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}
Pagination.displayName = "Pagination"

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
))
PaginationContent.displayName = "PaginationContent"

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
))
PaginationItem.displayName = "PaginationItem"

type PaginationLinkProps = {
  isActive?: boolean
} & { size?: "default" | "sm" | "lg" | "icon" } &
  React.ComponentProps<"a">

const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  href,
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? "outline" : "ghost",
        size,
      }),
      className
    )}
    href={href && withBasePathIfInApp(href)}
    {...props}
  />
)
PaginationLink.displayName = "PaginationLink"

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => {
  const label = useCommonText('a11y', 'goToPreviousPage', 'Go to previous page')
  const text = useCommonText('buttons', 'previous', 'Previous')
  return (
    <PaginationLink
      aria-label={label}
      size="default"
      className={cn("gap-1 pl-2.5", className)}
      {...props}
    >
      <ChevronLeftIcon className="h-4 w-4" />
      <span>{text}</span>
    </PaginationLink>
  )
}
PaginationPrevious.displayName = "PaginationPrevious"

const PaginationNext = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => {
  const label = useCommonText('a11y', 'goToNextPage', 'Go to next page')
  const text = useCommonText('buttons', 'next', 'Next')
  return (
    <PaginationLink
      aria-label={label}
      size="default"
      className={cn("gap-1 pr-2.5", className)}
      {...props}
    >
      <span>{text}</span>
      <ChevronRightIcon className="h-4 w-4" />
    </PaginationLink>
  )
}
PaginationNext.displayName = "PaginationNext"

const PaginationEllipsis = ({
  className,
  moreLabel,
  ...props
}: React.ComponentProps<"span"> & { moreLabel?: string }) => {
  const label = useCommonText('a11y', 'morePages', 'More pages', moreLabel)
  return (
    <span
      aria-hidden
      className={cn("flex h-9 w-9 items-center justify-center", className)}
      {...props}
    >
      <DotsHorizontalIcon className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
PaginationEllipsis.displayName = "PaginationEllipsis"

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
