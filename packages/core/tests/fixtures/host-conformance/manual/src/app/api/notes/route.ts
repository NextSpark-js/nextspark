import { getNotesForViewer } from '@/lib/notes-data'

export async function GET() {
  const notes = await getNotesForViewer()
  if (!notes) return Response.json({ error: 'unauthorized' }, { status: 401 })
  return Response.json({ notes })
}
