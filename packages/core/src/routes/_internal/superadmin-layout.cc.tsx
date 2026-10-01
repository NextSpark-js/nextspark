import type { ComponentType } from 'react'
import { withSuperadminMessages } from './group-layouts.cc'
import { guardSuperadminLayout, type SuperadminLayoutProps } from './superadmin-layout'

/**
 * What a project's superadmin layout is composed with in Cache Components mode (the manifest's `compose` of that
 * variant): the mode's messages, then core's role guard around the project's layout, as `withSuperadminGuard` does in
 * the ISR module. A module of its own so only the superadmin route group imports the guard and its client components.
 */
export const withSuperadminGuard = (ProjectLayout: ComponentType<SuperadminLayoutProps>) => withSuperadminMessages(guardSuperadminLayout(ProjectLayout))
