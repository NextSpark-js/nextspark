import type { ComponentType, ReactNode } from 'react'
import { GroupToaster } from '@nextsparkjs/core/providers/group-toaster'
import { withAuthMessages as withStaticAuthMessages } from './group-layouts.cc'

/**
 * The composition module of a project's (auth) layout in Cache Components mode (the manifest's `compose` of that
 * variant): the mode's message wrapper, and the metadata the override keeps when it declares none. Neither imports
 * core's default layout, so an override's route ships none of its client components.
 *
 * The wrapper also puts the layout in GroupToaster, so with `providers.scope: 'groups'` (the root layout mounts
 * neither React Query nor the toaster) the auth pages still have the toaster, and no React Query; with the default
 * scope it adds nothing. It lives here and not in ./group-layouts.cc, which the (public) layout imports too.
 */
export function withAuthMessages<P extends { children: ReactNode }>(AuthLayout: ComponentType<P>) {
  return withStaticAuthMessages(function AuthLayoutWithProviders(props: P) {
    return (
      <GroupToaster>
        <AuthLayout {...props} />
      </GroupToaster>
    )
  })
}
export { metadata } from './auth-layout'
