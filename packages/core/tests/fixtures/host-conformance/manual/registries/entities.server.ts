// Hand-written registry of the manual (reference) host.
import { entity as notes } from '@/entities/notes/entity'
import { entity as posts } from '@/entities/posts/entity'
import { entity as widgets } from '@/entities/widgets/entity'

export const ENTITY_REGISTRY = { notes, posts, widgets } as const
