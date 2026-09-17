import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  rename,
  writeTextFile,
  BaseDirectory,
} from '@tauri-apps/plugin-fs'
import type { FsAdapter } from './notes'

/**
 * Real offline files in the app's private folder (works on Android/iOS
 * and desktop). Notes live under `notes/`, mirroring the memory adapter.
 */
export function createTauriFs(): FsAdapter {
  const opts = { baseDir: BaseDirectory.AppData as const }
  return {
    async readText(path) {
      return readTextFile(path, opts)
    },
    async writeText(path, content) {
      await writeTextFile(path, content, opts)
    },
    async remove(path, recursive) {
      await remove(path, { ...opts, recursive })
    },
    async mkdir(path) {
      await mkdir(path, { ...opts, recursive: true })
    },
    async listDir(path) {
      const entries = await readDir(path, opts)
      return entries.map((e) => ({ name: e.name, isDir: e.isDirectory }))
    },
    async exists(path) {
      return exists(path, opts)
    },
    async move(oldPath, newPath) {
      await rename(oldPath, newPath, {
        oldPathBaseDir: BaseDirectory.AppData,
        newPathBaseDir: BaseDirectory.AppData,
      })
    },
  }
}

/** True inside the Tauri runtime (device or desktop), false on plain web. */
export function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  )
}
