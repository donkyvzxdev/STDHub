import {
  childPath,
  fsError,
  parentDir,
  sanitizeName,
  type FileNode,
  type FileProvider,
} from './filesystem'

const MAX_BYTES = 1024 * 1024

interface WebFileHandle {
  kind: 'file'
  name: string
  getFile(): Promise<File>
  createWritable(): Promise<{
    write(content: string | Uint8Array): Promise<void>
    close(): Promise<void>
  }>
}

interface WebDirHandle {
  kind: 'directory'
  name: string
  values(): AsyncIterableIterator<WebFileHandle | WebDirHandle>
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<WebFileHandle>
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<WebDirHandle>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite'
    }) => Promise<WebDirHandle>
  }
}

export function hasFileSystemAccess(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.showDirectoryPicker === 'function'
  )
}

/**
 * File provider on top of the File System Access API (Chromium desktop).
 * Directory handles cannot be serialized, so they live in memory, keyed by
 * the display root name. State is lost on reload by design (guest-first).
 */
export class WebFileProvider implements FileProvider {
  readonly kind = 'web' as const
  private root: WebDirHandle | null = null

  async openFolder(): Promise<string | null> {
    if (!hasFileSystemAccess()) throw fsError('unsupported')
    const dir = await window.showDirectoryPicker?.({ mode: 'readwrite' })
    if (!dir) return null
    this.root = dir
    return dir.name
  }

  private parts(path: string): string[] {
    return path.split('/').filter((p) => p !== '')
  }

  private async resolveDir(path: string): Promise<WebDirHandle> {
    if (!this.root) throw fsError('not-found')
    const parts = this.parts(path)
    // First segment is the root display name — skip it.
    let dir = this.root
    for (const part of parts.slice(1)) {
      try {
        dir = await dir.getDirectoryHandle(part)
      } catch {
        throw fsError('not-found')
      }
    }
    return dir
  }

  private async resolveParent(
    path: string,
  ): Promise<{ dir: WebDirHandle; name: string }> {
    const parts = this.parts(path)
    const name = parts[parts.length - 1] ?? ''
    const dir = await this.resolveDir(parts.slice(0, -1).join('/'))
    return { dir, name }
  }

  async listDir(path: string): Promise<FileNode[]> {
    const dir = await this.resolveDir(path)
    const nodes: FileNode[] = []
    for await (const entry of dir.values()) {
      nodes.push({
        path: childPath(path, entry.name),
        name: entry.name,
        isDir: entry.kind === 'directory',
      })
    }
    return nodes.sort(
      (a, b) =>
        Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name),
    )
  }

  async readText(path: string): Promise<string> {
    const { dir, name } = await this.resolveParent(path)
    let handle: WebFileHandle
    try {
      handle = await dir.getFileHandle(name)
    } catch {
      throw fsError('not-found')
    }
    const file = await handle.getFile()
    if (file.size > MAX_BYTES) throw fsError('too-large')
    const text = await file.text()
    if ([...text].some((c) => c.charCodeAt(0) === 0)) throw fsError('binary')
    return text
  }

  async readBinary(path: string): Promise<Uint8Array> {
    const { dir, name } = await this.resolveParent(path)
    let handle: WebFileHandle
    try {
      handle = await dir.getFileHandle(name)
    } catch {
      throw fsError('not-found')
    }
    const file = await handle.getFile()
    if (file.size > MAX_BYTES) throw fsError('too-large')
    return new Uint8Array(await file.arrayBuffer())
  }

  async writeBinary(path: string, data: Uint8Array): Promise<void> {
    const { dir, name } = await this.resolveParent(path)
    const handle = await dir.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    await writable.write(data)
    await writable.close()
  }

  async writeText(path: string, content: string): Promise<void> {
    const { dir, name } = await this.resolveParent(path)
    const handle = await dir.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
  }

  async createFile(dirPath: string, name: string): Promise<string> {
    const clean = sanitizeName(name)
    if (!clean) throw fsError('invalid-name')
    const dir = await this.resolveDir(dirPath)
    try {
      await dir.getFileHandle(clean)
      throw fsError('exists')
    } catch (e) {
      if (e instanceof Error && e.message === 'exists') throw e
    }
    await dir.getFileHandle(clean, { create: true })
    return childPath(dirPath, clean)
  }

  async createDir(dirPath: string, name: string): Promise<string> {
    const clean = sanitizeName(name)
    if (!clean) throw fsError('invalid-name')
    const dir = await this.resolveDir(dirPath)
    try {
      await dir.getDirectoryHandle(clean)
      throw fsError('exists')
    } catch (e) {
      if (e instanceof Error && e.message === 'exists') throw e
    }
    await dir.getDirectoryHandle(clean, { create: true })
    return childPath(dirPath, clean)
  }

  async rename(oldPath: string, newName: string): Promise<string> {    const clean = sanitizeName(newName)
    if (!clean) throw fsError('invalid-name')
    const { dir, name } = await this.resolveParent(oldPath)
    const full = childPath(parentDir(oldPath), clean)
    if (full === oldPath) return oldPath
    const isDir = await this.isDirectory(dir, name)
    if (isDir) {
      await this.copyDir(dir, name, clean)
      await dir.removeEntry(name, { recursive: true })
    } else {
      const text = await this.readHandle(dir, name)
      await this.writeHandle(dir, clean, text)
      await dir.removeEntry(name)
    }
    return full
  }

  async remove(path: string, recursive: boolean): Promise<void> {
    const { dir, name } = await this.resolveParent(path)
    await dir.removeEntry(name, { recursive })
  }

  async move(oldPath: string, newPath: string): Promise<void> {
    const from = await this.resolveParent(oldPath)
    const to = await this.resolveParent(newPath)
    const destTaken = await (async () => {
      try {
        await to.dir.getFileHandle(to.name)
        return true
      } catch {
        // Missing as a file — check directory below.
      }
      try {
        await to.dir.getDirectoryHandle(to.name)
        return true
      } catch {
        return false
      }
    })()
    if (destTaken) throw fsError('exists')
    if (await this.isDirectory(from.dir, from.name)) {
      await this.copyDir(from.dir, from.name, to.name)
      await from.dir.removeEntry(from.name, { recursive: true })
      return
    }
    const bytes = await this.readBinary(oldPath)
    await this.writeBinary(newPath, bytes)
    await from.dir.removeEntry(from.name)
  }

  private async isDirectory(
    dir: WebDirHandle,
    name: string,
  ): Promise<boolean> {
    try {
      await dir.getDirectoryHandle(name)
      return true
    } catch {
      return false
    }
  }

  private async readHandle(
    dir: WebDirHandle,
    name: string,
  ): Promise<string> {
    const handle = await dir.getFileHandle(name)
    const file = await handle.getFile()
    if (file.size > MAX_BYTES) throw fsError('too-large')
    return file.text()
  }

  private async writeHandle(
    dir: WebDirHandle,
    name: string,
    content: string,
  ): Promise<void> {
    const handle = await dir.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
  }

  private async copyDir(
    dir: WebDirHandle,
    from: string,
    to: string,
  ): Promise<void> {
    const src = await dir.getDirectoryHandle(from)
    const dest = await dir.getDirectoryHandle(to, { create: true })
    for await (const entry of src.values()) {
      if (entry.kind === 'directory') {
        await this.copyDirHandle(entry, dest)
      } else {
        const file = await (
          entry as WebFileHandle
        ).getFile()
        await this.writeHandle(dest, entry.name, await file.text())
      }
    }
  }

  private async copyDirHandle(
    src: WebDirHandle,
    destParent: WebDirHandle,
  ): Promise<void> {
    const dest = await destParent.getDirectoryHandle(src.name, {
      create: true,
    })
    for await (const entry of src.values()) {
      if (entry.kind === 'directory') {
        await this.copyDirHandle(entry, dest)
      } else {
        const file = await (entry as WebFileHandle).getFile()
        await this.writeHandle(dest, entry.name, await file.text())
      }
    }
  }
}

/** Provider used when neither Tauri nor the File System Access API exists. */
export class UnsupportedProvider implements FileProvider {
  readonly kind = 'none' as const
  async openFolder(): Promise<string | null> {
    throw fsError('unsupported')
  }
  async listDir(): Promise<FileNode[]> {
    throw fsError('unsupported')
  }
  async readText(): Promise<string> {
    throw fsError('unsupported')
  }
  async readBinary(): Promise<Uint8Array> {
    throw fsError('unsupported')
  }
  async writeBinary(): Promise<void> {
    throw fsError('unsupported')
  }
  async writeText(): Promise<void> {
    throw fsError('unsupported')
  }
  async createFile(): Promise<string> {
    throw fsError('unsupported')
  }
  async createDir(): Promise<string> {
    throw fsError('unsupported')
  }
  async rename(): Promise<string> {
    throw fsError('unsupported')
  }
  async move(): Promise<void> {
    throw fsError('unsupported')
  }
  async remove(): Promise<void> {
    throw fsError('unsupported')
  }
}
