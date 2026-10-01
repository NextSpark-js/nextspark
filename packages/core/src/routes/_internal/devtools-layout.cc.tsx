import type { ComponentType } from 'react'
import { withDevtoolsMessages } from './group-layouts.cc'
import { guardDevtoolsLayout, type DevLayoutProps } from './devtools-layout'

/**
 * What a project's devtools layout is composed with in Cache Components mode (the manifest's `compose` of that
 * variant): the mode's messages, then core's role guard around the project's layout, as `withDevtoolsGuard` does in the
 * ISR module. A module of its own so only the devtools route group imports the guard and its client components.
 */
export const withDevtoolsGuard = (ProjectLayout: ComponentType<DevLayoutProps>) => withDevtoolsMessages(guardDevtoolsLayout(ProjectLayout))
