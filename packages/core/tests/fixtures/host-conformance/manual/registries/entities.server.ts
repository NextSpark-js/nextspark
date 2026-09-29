// Hand-written registry of the manual (reference) host.
import { entity as notes } from '@/entities/notes/entity'
import { entity as posts } from '@/entities/posts/entity'

export const ENTITY_REGISTRY = { notes, posts } as const
