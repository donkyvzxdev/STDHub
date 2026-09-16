import { invoke } from '@tauri-apps/api/core'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import {
  create,
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  rename,
  stat,
  writeFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import {
  childPath,
  fsError,
  parentDir,
  sanitizeName,
  type FileNode,
  type FileProvider,
} from './filesystem'

const MAX_BYTES = 1024 * 1024

export function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  )
}

/**
 * Windows returns backslash paths; the whole app speaks forward slashes
 * (accepted by every OS, including Windows). Normalize at the boundary.
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

async function grantScope(path: string): Promise<void> {
  await invoke('grant_folder_scope', { path })
}

export class TauriFileProvider implements FileProvider {
  readonly kind = 'tauri' as const

  async openFolder(): Promise<string | null> {
    const picked = await openDialog({ directory: true, multiple: false })
    if (typeof picked !== 'string' || picked === '') return null
    await grantScope(picked)
    return normalizePath(picked)
  }

  async listDir(path: string): Promise<FileNode[]> {
    const entries = await readDir(normalizePath(path))
    return entries
      .map((entry) => ({
        path: childPath(path, entry.name),
        name: entry.name,
        isDir: entry.isDirectory,
      }))
      .sort(
        (a, b) =>
          Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name),
      )
  }

  async readText(path: string): Promise<string> {
    const target = normalizePath(path)
    const info = await stat(target)
    if (info.size > MAX_BYTES) throw fsError('too-large')
    const text = await readTextFile(target)
    if ([...text].some((c) => c.charCodeAt(0) === 0)) throw fsError('binary')
    return text
  }

  async readBinary(path: string): Promise<Uint8Array> {
    const target = normalizePath(path)
    const info = await stat(target)
    if (info.size > MAX_BYTES) throw fsError('too-large')
    return readFile(target)
  }

  async writeBinary(path: string, data: Uint8Array): Promise<void> {
    await writeFile(normalizePath(path), data)
  }

  async writeText(path: string, content: string): Promise<void> {
    await writeTextFile(normalizePath(path), content)
  }

  async createFile(dir: string, name: string): Promise<string> {
    const clean = sanitizeName(name)
    if (!clean) throw fsError('invalid-name')
    const full = childPath(dir, clean)
    if (await exists(full)) throw fsError('exists')
    const file = await create(full)
    await file.close()
    return full
  }

  async createDir(dir: string, name: string): Promise<string> {
    const clean = sanitizeName(name)
    if (!clean) throw fsError('invalid-name')
    const full = childPath(dir, clean)
    if (await exists(full)) throw fsError('exists')
    await mkdir(full)
    return full
  }
  async rename(oldPath: string, newName: string): Promise<string> {
    const clean = sanitizeName(newName)
    if (!clean) throw fsError('invalid-name')
    const full = childPath(parentDir(oldPath), clean)
    if (full === oldPath) return oldPath
    if (await exists(full)) throw fsError('exists')
    await rename(oldPath, full)
    return full
  }

  async move(oldPath: string, newPath: string): Promise<void> {
    const from = normalizePath(oldPath)
    const to = normalizePath(newPath)
    if (await exists(to)) throw fsError('exists')
    await rename(from, to)
  }

  async remove(path: string, recursive: boolean): Promise<void> {
    await remove(normalizePath(path), { recursive })
  }
}
