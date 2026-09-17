import { describe, expect, it } from 'vitest'
import {
  createFolder,
  createMemoryFs,
  deleteFolder,
  deleteNote,
  listFolders,
  listNotes,
  readNote,
  renameNote,
  sanitizeFolder,
  sanitizeName,
  saveNoteContent,
  titleFromContent,
  writeNote,
} from './notes'

describe('mobile notes', () => {
  it('validates names', () => {
    expect(sanitizeName('  Frações ')).toBe('Frações.md')
    expect(sanitizeName('a.md')).toBe('a.md')
    expect(sanitizeName('')).toBeNull()
    expect(sanitizeName('a/b')).toBeNull()
    expect(sanitizeFolder('Matemática')).toBe('Matemática')
    expect(sanitizeFolder('..')).toBeNull()
  })

  it('creates, reads, renames and deletes notes', async () => {
    const fs = createMemoryFs()
    const path = await writeNote(fs, '', 'Hello', '# Hello\nbody')
    expect(path).toBe('Hello.md')
    expect(await readNote(fs, path)).toBe('# Hello\nbody')
    await expect(writeNote(fs, '', 'Hello', 'x')).rejects.toThrow('exists')
    const renamed = await renameNote(fs, path, 'Hi')
    expect(renamed).toBe('Hi.md')
    await saveNoteContent(fs, renamed, 'changed')
    expect(await readNote(fs, renamed)).toBe('changed')
    await deleteNote(fs, renamed)
    expect((await listNotes(fs)).length).toBe(0)
  })

  it('organizes folders', async () => {
    const fs = createMemoryFs()
    await createFolder(fs, 'Matemática')
    await writeNote(fs, 'Matemática', 'Frações', 'x')
    await writeNote(fs, '', 'Root', 'y')
    const notes = await listNotes(fs)
    expect(notes.map((n) => n.path).sort()).toEqual([
      'Matemática/Frações.md',
      'Root.md',
    ])
    const folders = await listFolders(fs)
    expect(folders.map((f) => f.path).sort()).toEqual(['', 'Matemática'])
    await deleteFolder(fs, 'Matemática')
    expect((await listNotes(fs)).map((n) => n.path)).toEqual(['Root.md'])
    await expect(deleteFolder(fs, '')).rejects.toThrow()
  })

  it('sees seeded files', async () => {
    const fs = createMemoryFs({ 'notes/A/B.md': 'b', 'notes/C.md': 'c' })
    expect((await listNotes(fs)).map((n) => n.path).sort()).toEqual([
      'A/B.md',
      'C.md',
    ])
  })

  it('derives titles', () => {
    expect(titleFromContent('# Title\nbody', 'F')).toBe('Title')
    expect(titleFromContent('\n\nbody text here', 'F')).toBe('body text here')
    expect(titleFromContent('', 'Fallback')).toBe('Fallback')
  })
})
