import type { Metadata } from 'next'
import { addNote } from '@/actions/notes'
import { getNotesForViewer } from '@/lib/notes-data'

export const metadata: Metadata = { title: 'Notes' }

export default async function NotesPage() {
  const notes = await getNotesForViewer()
  if (!notes) return <p data-probe="notes-anonymous">Sign in to see your notes.</p>
  return (
    <div data-probe="notes-signed-in">
      <ul>
        {notes.map(note => (
          <li key={note.id}>{note.title}</li>
        ))}
      </ul>
      <form action={addNote}>
        <input name="title" defaultValue="From the form" />
        <button type="submit">Add</button>
      </form>
    </div>
  )
}
