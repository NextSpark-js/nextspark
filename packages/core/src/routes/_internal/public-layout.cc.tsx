/**
 * The composition module of a project's (public) layout in Cache Components mode (the manifest's `compose` of that
 * variant): the mode's message wrapper, and the metadata the override keeps when it declares none. Neither imports
 * core's default layout, so an override's route ships none of its client components.
 */
export { withPublicMessages } from './group-layouts.cc'
export { metadata } from './public-layout'
