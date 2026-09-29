'use server'

import { redirect } from 'next/navigation'
import { addNoteForViewer } from '@/lib/notes-data'

export async function addNote(formData: FormData) {
  await addNoteForViewer(String(formData.get('title') ?? 'untitled'))
  redirect('/notes?added=1')
}
