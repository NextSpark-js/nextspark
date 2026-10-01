import type { ComponentType } from 'react'
import { withSuperadminMessages } from './group-layouts.cc'
import { guardSuperadminLayout, type SuperadminLayoutProps } from './superadmin-layout'
import { withAreaGate } from './area-access'

/**
 * Core's superadmin layout in Cache Components mode (the route's default): the mode's messages around the
 * server-side role check (area-access), which renders the layout only for superadmin and developer sessions.
 */
export const withSuperadminAreaMessages = (Layout: ComponentType<SuperadminLayoutProps>) => withSuperadminMessages(withAreaGate('superadmin', Layout))

/**
 * What a project's superadmin layout is composed with in Cache Components mode (the manifest's `compose` of that
 * variant): the mode's messages and the server-side role check, then core's client guard around the project's layout,
 * as `withSuperadminGuard` does in the ISR module. A module of its own so only the superadmin route group imports the
 * guard, the role check and their client components.
 */
export const withSuperadminGuard = (ProjectLayout: ComponentType<SuperadminLayoutProps>) => withSuperadminAreaMessages(guardSuperadminLayout(ProjectLayout))
