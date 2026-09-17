import { createMemoryFs, type FsAdapter } from './notes'
import { createTauriFs, isTauriRuntime } from './tauriFs'

let cached: FsAdapter | null = null

/** App-wide filesystem: real offline files on device, memory on web dev. */
export function getFs(): FsAdapter {
  if (!cached) {
    cached = isTauriRuntime() ? createTauriFs() : createMemoryFs()
  }
  return cached
}

/** Test-only reset. */
export function resetFs(adapter?: FsAdapter): void {
  cached = adapter ?? null
}
