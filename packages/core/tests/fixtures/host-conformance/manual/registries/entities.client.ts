// Hand-written registry of the manual (reference) host.
import { clientEntity as notes } from '@/entities/notes/client'
import { clientEntity as posts } from '@/entities/posts/client'
import { clientEntity as widgets } from '@/entities/widgets/client'

export const CLIENT_ENTITY_REGISTRY = { notes, posts, widgets } as const
