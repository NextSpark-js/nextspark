/** A locally declared require is not CommonJS for base-path.in-app-urls.test.ts. */
import { withBasePathIfInApp } from '../../../../src/lib/base-path'

function require(_specifier: string) {
  return { default: 'span', Image: 'span' } as const
}

export function LocalRequire({ href }: { href: string }) {
  const Linked = require('next/link').default
  const Avatar = require('@radix-ui/react-avatar').Image
  const { default: Pictured } = require('next/image')
  return (
    <>
      <Linked href={withBasePathIfInApp('/docs')}>Docs</Linked>
      <Avatar src={href} />
      <Pictured src={href} />
    </>
  )
}
