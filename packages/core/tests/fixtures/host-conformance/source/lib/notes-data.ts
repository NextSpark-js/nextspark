import { getSession } from './session'

export type Note = { id: string; title: string }

const NOTES: Note[] = [
  { id: 'n1', title: 'First synthetic note' },
  { id: 'n2', title: 'Second synthetic note' },
]

/**
 * Data access owns the authorization check: pages, route handlers and actions all go through
 * here, so a caller cannot read notes by forgetting to check the session (the layout does not).
 */
export async function getNotesForViewer(): Promise<Note[] | null> {
  const session = await getSession()
  if (!session) return null
  return NOTES
}

export async function addNoteForViewer(title: string): Promise<Note> {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  return { id: `n${NOTES.length + 1}`, title }
}
