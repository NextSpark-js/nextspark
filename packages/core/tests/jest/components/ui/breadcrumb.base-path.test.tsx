/**
 * A breadcrumb link to a page of the app points under its base path (#198).
 *
 * BreadcrumbLink renders an <a>, or with `asChild` hands its props to the child,
 * and Next.js prefixes neither: under a base path, `href="/dashboard"` written
 * as given is a link to a page the app does not serve.
 */
import * as React from 'react'
import { cleanup, render, screen } from '@testing-library/react'

const ORIGINAL_BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH

// next/link reads the base path once, when it is first loaded, the way a build inlines it;
// the breadcrumb loads it too
process.env.__NEXT_ROUTER_BASEPATH = '/base'
const Link: typeof import('next/link').default = require('next/link').default
const { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList }: typeof import('@/core/components/ui/breadcrumb') =
  require('@/core/components/ui/breadcrumb')

afterEach(() => {
  if (ORIGINAL_BASE_PATH === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
  else process.env.__NEXT_ROUTER_BASEPATH = ORIGINAL_BASE_PATH
})

function linkTarget(link: React.ReactElement) {
  render(
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>{link}</BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
  return screen.getByRole('link', { name: 'Dashboard' }).getAttribute('href')
}

describe('BreadcrumbLink under a base path', () => {
  beforeEach(() => {
    process.env.__NEXT_ROUTER_BASEPATH = '/base'
  })

  test('a link to a page of the app points under the base path', () => {
    expect(linkTarget(<BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>)).toBe('/base/dashboard')
  })

  test('a link that already carries the base path gets it once', () => {
    expect(linkTarget(<BreadcrumbLink href="/base/dashboard">Dashboard</BreadcrumbLink>)).toBe('/base/dashboard')
  })

  test('a link to another origin is left as it is', () => {
    expect(linkTarget(<BreadcrumbLink href="https://docs.example.com/guide">Dashboard</BreadcrumbLink>)).toBe(
      'https://docs.example.com/guide'
    )
  })

  test('with asChild, the child it renders gets the href under the base path', () => {
    expect(
      linkTarget(
        <BreadcrumbLink asChild href="/dashboard">
          <a>Dashboard</a>
        </BreadcrumbLink>
      )
    ).toBe('/base/dashboard')
  })

  test("with asChild, an <a> child's own href points under the base path", () => {
    expect(
      linkTarget(
        <BreadcrumbLink asChild>
          <a href="/dashboard">Dashboard</a>
        </BreadcrumbLink>
      )
    ).toBe('/base/dashboard')
  })

  test("with asChild, an <a> child's own href wins over the link's, and gets the base path once", () => {
    expect(
      linkTarget(
        <BreadcrumbLink asChild href="/settings">
          <a href="/base/dashboard">Dashboard</a>
        </BreadcrumbLink>
      )
    ).toBe('/base/dashboard')
  })

  test('with asChild, a component child that renders an <a> is given the href under the base path', () => {
    const Anchor = React.forwardRef<HTMLAnchorElement, React.ComponentPropsWithoutRef<'a'>>((props, ref) => <a ref={ref} {...props} />)
    Anchor.displayName = 'Anchor'
    expect(
      linkTarget(
        <BreadcrumbLink asChild href="/dashboard">
          <Anchor>Dashboard</Anchor>
        </BreadcrumbLink>
      )
    ).toBe('/base/dashboard')
  })

  test('with asChild, a <Link> child puts the base path on once, whichever of the two carries the href', () => {
    expect(
      linkTarget(
        <BreadcrumbLink asChild>
          <Link href="/dashboard">Dashboard</Link>
        </BreadcrumbLink>
      )
    ).toBe('/base/dashboard')
    cleanup()
    expect(
      linkTarget(
        <BreadcrumbLink asChild href="/dashboard">
          {/* @ts-expect-error the href reaches the <Link> through the Slot */}
          <Link>Dashboard</Link>
        </BreadcrumbLink>
      )
    ).toBe('/base/dashboard')
  })
})

describe('BreadcrumbLink with no base path', () => {
  beforeEach(() => {
    delete process.env.__NEXT_ROUTER_BASEPATH
  })

  test('a link to a page of the app points where it was written', () => {
    expect(linkTarget(<BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>)).toBe('/dashboard')
  })

  test('with asChild, an <a> child points where it was written', () => {
    expect(
      linkTarget(
        <BreadcrumbLink asChild>
          <a href="/dashboard">Dashboard</a>
        </BreadcrumbLink>
      )
    ).toBe('/dashboard')
  })
})
