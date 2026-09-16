export interface FileNode {
  path: string
  name: string
  isDir: boolean
  children?: FileNode[]
}

export type FsErrorCode =
  | 'cancelled'
  | 'too-large'
  | 'binary'
  | 'invalid-name'
  | 'exists'
  | 'not-found'
  | 'unsupported'
  | 'failed'

export function fsError(code: FsErrorCode): Error {
  return new Error(code)
}

export function fsCode(e: unknown): FsErrorCode {
  if (
    e instanceof Error &&
    (e.message === 'cancelled' ||
      e.message === 'too-large' ||
      e.message === 'binary' ||
      e.message === 'invalid-name' ||
      e.message === 'exists' ||
      e.message === 'not-found' ||
      e.message === 'unsupported')
  ) {
    return e.message
  }
  return 'failed'
}

export interface FileProvider {
  readonly kind: 'tauri' | 'web' | 'none'
  openFolder(): Promise<string | null>
  listDir(path: string): Promise<FileNode[]>
  readText(path: string): Promise<string>
  readBinary(path: string): Promise<Uint8Array>
  writeBinary(path: string, data: Uint8Array): Promise<void>
  writeText(path: string, content: string): Promise<void>
  createFile(dir: string, name: string): Promise<string>
  createDir(dir: string, name: string): Promise<string>
  rename(oldPath: string, newName: string): Promise<string>
  move(oldPath: string, newPath: string): Promise<void>
  remove(path: string, recursive: boolean): Promise<void>
}

/** Join with forward slashes (accepted on every OS, including Windows). */
export function childPath(dir: string, name: string): string {
  return dir === '' ? name : `${dir}/${name}`
}

export function baseName(path: string): string {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return cut < 0 ? path : path.slice(cut + 1)
}

export function parentDir(path: string): string {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return cut < 0 ? '' : path.slice(0, cut)
}

/** Returns a cleaned name or null when it cannot be a file/folder name. */
export function sanitizeName(raw: string): string | null {
  const name = raw.trim()
  if (name === '' || name === '.' || name === '..') return null
  if (/[/\\:*?"<>|]/.test(name)) return null
  if ([...name].some((c) => c < ' ')) return null
  if (/[. ]$/.test(name)) return null
  return name
}

/** Sibling path with " copy" suffix before the extension, e.g. a copy.md. */
export function copyName(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return `${name} copy`
  return `${name.slice(0, dot)} copy${name.slice(dot)}`
}
