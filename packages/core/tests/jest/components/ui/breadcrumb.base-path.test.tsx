/**
 * A breadcrumb link to a page of the app points under its base path (#198).
 *
 * BreadcrumbLink renders an <a>, or with `asChild` hands its props to the child,
 * and Next.js prefixes neither: under a base path, `href="/dashboard"` written
 * as given is a link to a page the app does not serve.
 */
import { render, screen } from '@testing-library/react'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from '@/core/components/ui/breadcrumb'

const ORIGINAL_BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH

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

  test("with asChild, a child's own href is the child's to prefix", () => {
    expect(
      linkTarget(
        <BreadcrumbLink asChild>
          <a href="/base/dashboard">Dashboard</a>
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
})
