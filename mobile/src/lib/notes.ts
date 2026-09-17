/**
 * Minimal filesystem abstraction. Tauri provides real offline files;
 * memory keeps web-dev and tests working. Notes are plain `.md` files,
 * folders are directories — the same layout everywhere.
 */
export interface FsAdapter {
  readText(path: string): Promise<string>
  writeText(path: string, content: string): Promise<void>
  remove(path: string, recursive: boolean): Promise<void>
  mkdir(path: string): Promise<void>
  listDir(path: string): Promise<{ name: string; isDir: boolean }[]>
  exists(path: string): Promise<boolean>
  move(oldPath: string, newPath: string): Promise<void>
}

export interface NoteEntry {
  id: string
  /** Display path relative to the notes root, e.g. `Matemática/Frações.md`. */
  path: string
  title: string
  updatedAt: number
}

export interface FolderEntry {
  path: string
  name: string
}

const NOTES_ROOT = 'notes'

function join(dir: string, name: string): string {
  return dir === '' ? name : `${dir}/${name}`
}

function dirOf(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut < 0 ? '' : path.slice(0, cut)
}

function baseOf(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut < 0 ? path : path.slice(cut + 1)
}

/** File names may not contain slashes or control characters. */
export function sanitizeName(raw: string): string | null {
  const name = raw.trim().replace(/\.md$/i, '')
  if (name === '' || name === '.' || name === '..') return null
  if (/[/\\:*?"<>|]/.test(name)) return null
  if ([...name].some((c) => c < ' ')) return null
  return `${name}.md`
}

export function sanitizeFolder(raw: string): string | null {
  const name = raw.trim()
  if (name === '' || name === '.' || name === '..') return null
  if (/[/\\:*?"<>|]/.test(name)) return null
  if ([...name].some((c) => c < ' ')) return null
  return name
}

export function titleFromContent(content: string, fallback: string): string {
  for (const line of content.split('\n')) {
    const clean = line.replace(/^#+\s*/, '').trim()
    if (clean !== '') return clean.slice(0, 60)
  }
  return fallback
}

async function walk(
  fs: FsAdapter,
  dir: string,
  out: NoteEntry[],
): Promise<void> {
  let entries: { name: string; isDir: boolean }[]
  try {
    entries = await fs.listDir(dir === '' ? NOTES_ROOT : join(NOTES_ROOT, dir))
  } catch {
    return
  }
  for (const entry of entries) {
    const rel = join(dir, entry.name)
    if (entry.isDir) {
      await walk(fs, rel, out)
    } else if (/\.md$/i.test(entry.name)) {
      out.push({
        id: rel,
        path: rel,
        title: entry.name.replace(/\.md$/i, ''),
        updatedAt: 0,
      })
    }
  }
}

/** All notes, newest storage order; folders derived from paths. */
export async function listNotes(fs: FsAdapter): Promise<NoteEntry[]> {
  const out: NoteEntry[] = []
  await walk(fs, '', out)
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

export async function listFolders(fs: FsAdapter): Promise<FolderEntry[]> {
  const folders = new Map<string, FolderEntry>([['', { path: '', name: '' }]])
  const notes = await listNotes(fs)
  for (const note of notes) {
    const dir = dirOf(note.path)
    if (dir !== '' && !folders.has(dir)) {
      folders.set(dir, { path: dir, name: baseOf(dir) })
    }
  }
  // Empty folders have no notes to discover them — list top level too.
  try {
    const top = await fs.listDir(NOTES_ROOT)
    for (const entry of top) {
      if (entry.isDir && !folders.has(entry.name)) {
        folders.set(entry.name, { path: entry.name, name: entry.name })
      }
    }
  } catch {
    // Root missing yet — no folders.
  }
  return [...folders.values()].sort((a, b) => a.path.localeCompare(b.path))
}

export async function readNote(fs: FsAdapter, path: string): Promise<string> {
  return fs.readText(join(NOTES_ROOT, path))
}

export async function writeNote(
  fs: FsAdapter,
  dir: string,
  name: string,
  content: string,
): Promise<string> {
  const clean = sanitizeName(name)
  if (!clean) throw new Error('invalid-name')
  const fullDir = dir === '' ? NOTES_ROOT : join(NOTES_ROOT, dir)
  if (dir !== '') {
    try {
      await fs.mkdir(fullDir)
    } catch {
      // Exists already — fine.
    }
  }
  const full = join(fullDir, clean)
  if (await fs.exists(full)) throw new Error('exists')
  await fs.writeText(full, content)
  return join(dir, clean)
}

export async function saveNoteContent(
  fs: FsAdapter,
  path: string,
  content: string,
): Promise<void> {
  await fs.writeText(join(NOTES_ROOT, path), content)
}

export async function renameNote(
  fs: FsAdapter,
  oldPath: string,
  newName: string,
): Promise<string> {
  const clean = sanitizeName(newName)
  if (!clean) throw new Error('invalid-name')
  const dir = dirOf(oldPath)
  const full = join(dir === '' ? NOTES_ROOT : join(NOTES_ROOT, dir), clean)
  if (full !== join(NOTES_ROOT, oldPath) && (await fs.exists(full))) {
    throw new Error('exists')
  }
  await fs.move(join(NOTES_ROOT, oldPath), full)
  return join(dir, clean)
}

export async function deleteNote(fs: FsAdapter, path: string): Promise<void> {
  await fs.remove(join(NOTES_ROOT, path), false)
}

export async function createFolder(fs: FsAdapter, name: string): Promise<string> {
  const clean = sanitizeFolder(name)
  if (!clean) throw new Error('invalid-name')
  if (await fs.exists(join(NOTES_ROOT, clean))) throw new Error('exists')
  await fs.mkdir(join(NOTES_ROOT, clean))
  return clean
}

export async function deleteFolder(fs: FsAdapter, path: string): Promise<void> {
  if (path === '') throw new Error('invalid-name')
  await fs.remove(join(NOTES_ROOT, path), true)
}

/** In-memory adapter: tests + browser dev fallback (session-only). */
export function createMemoryFs(seed: Record<string, string> = {}): FsAdapter & {
  dump: () => Record<string, string>
} {
  // All paths are full, including the notes root (e.g. `notes/Mat/F.md`).
  const files = new Map<string, string>(Object.entries(seed))
  const dirs = new Set<string>([NOTES_ROOT])
  const ensureParents = (dir: string): void => {
    let cur = dir
    while (cur !== '' && !dirs.has(cur)) {
      dirs.add(cur)
      cur = dirOf(cur)
    }
  }
  for (const path of files.keys()) ensureParents(dirOf(path))
  const childrenOf = (dir: string): { name: string; isDir: boolean }[] => {
    const prefix = `${dir}/`
    const seen = new Map<string, boolean>()
    for (const path of files.keys()) {
      if (!path.startsWith(prefix)) continue
      const rest = path.slice(prefix.length)
      if (rest === '' || rest.includes('/')) continue
      seen.set(rest, false)
    }
    for (const dirPath of dirs) {
      if (dirPath === dir) continue
      if (dirOf(dirPath) === dir) seen.set(baseOf(dirPath), true)
    }
    return [...seen.entries()]
      .map(([name, isDir]) => ({ name, isDir }))
      .sort(
        (a, b) =>
          Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name),
      )
  }
  return {
    dump: () => Object.fromEntries(files),
    async readText(path) {
      const content = files.get(path)
      if (content === undefined) throw new Error('not-found')
      return content
    },
    async writeText(path, content) {
      files.set(path, content)
      ensureParents(dirOf(path))
    },
    async remove(path, recursive) {
      if (files.has(path)) {
        files.delete(path)
        return
      }
      const prefix = `${path}/`
      const nested = [...files.keys()].some((p) => p.startsWith(prefix))
      if (!nested && !dirs.has(path)) throw new Error('not-found')
      if (nested && !recursive) throw new Error('not-empty')
      for (const key of files.keys()) {
        if (key === path || key.startsWith(prefix)) files.delete(key)
      }
      for (const dir of dirs) {
        if (dir === path || dir.startsWith(prefix)) dirs.delete(dir)
      }
    },
    async mkdir(path) {
      ensureParents(dirOf(path))
      dirs.add(path)
    },
    async listDir(path) {
      if (!dirs.has(path)) {
        // Implicit empty root on first run before anything was created.
        if (path === NOTES_ROOT) {
          dirs.add(path)
          return []
        }
        throw new Error('not-found')
      }
      return childrenOf(path).map((e) => ({ ...e }))
    },
    async exists(path) {
      if (files.has(path) || dirs.has(path)) return true
      return [...files.keys()].some((p) => p.startsWith(`${path}/`))
    },
    async move(oldPath, newPath) {
      const content = files.get(oldPath)
      if (content === undefined) throw new Error('not-found')
      if (files.has(newPath)) throw new Error('exists')
      files.delete(oldPath)
      files.set(newPath, content)
    },
  }
}
