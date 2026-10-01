import type { ComponentType } from 'react'
import { withDevtoolsMessages } from './group-layouts.cc'
import { guardDevtoolsLayout, type DevLayoutProps } from './devtools-layout'
import { withAreaGate } from './area-access'

/**
 * Core's devtools layout in Cache Components mode (the route's default): the mode's messages around the server-side
 * role check (area-access), which renders the layout only for developer sessions.
 */
export const withDevtoolsAreaMessages = (Layout: ComponentType<DevLayoutProps>) => withDevtoolsMessages(withAreaGate('devtools', Layout))

/**
 * What a project's devtools layout is composed with in Cache Components mode (the manifest's `compose` of that
 * variant): the mode's messages and the server-side role check, then core's client guard around the project's layout,
 * as `withDevtoolsGuard` does in the ISR module. A module of its own so only the devtools route group imports the guard,
 * the role check and their client components.
 */
export const withDevtoolsGuard = (ProjectLayout: ComponentType<DevLayoutProps>) => withDevtoolsAreaMessages(guardDevtoolsLayout(ProjectLayout))
