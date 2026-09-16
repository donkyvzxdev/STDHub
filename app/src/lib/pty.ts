import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { fsError } from './filesystem'
import { isTauriRuntime } from './tauriFs'

export interface PtyOutput {
  id: string
  data: string
}

export interface PtyExit {
  id: string
}

/** Drag-and-drop mime for moving a terminal tab between groups. */
export const TERMINAL_MIME = 'application/x-stdhub-terminal'

/**
 * Integrated PTY terminals (desktop only). The backend spawns a fixed shell
 * per OS — PowerShell on Windows, `$SHELL`/`sh` on Unix — rooted at a
 * user-picked folder. Output streams back through window events.
 */
export async function spawnTerminal(
  id: string,
  cwd: string,
  cols: number,
  rows: number,
): Promise<void> {
  if (!isTauriRuntime()) throw fsError('unsupported')
  await invoke('terminal_spawn', { id, cwd, cols, rows })
}

export async function writeTerminal(id: string, data: string): Promise<void> {
  if (!isTauriRuntime()) throw fsError('unsupported')
  await invoke('terminal_write', { id, data })
}

export async function resizeTerminal(
  id: string,
  cols: number,
  rows: number,
): Promise<void> {
  if (!isTauriRuntime()) throw fsError('unsupported')
  await invoke('terminal_resize', { id, cols, rows })
}

export async function killTerminal(id: string): Promise<void> {
  if (!isTauriRuntime()) throw fsError('unsupported')
  await invoke('terminal_kill', { id })
}

/**
 * Opens a native terminal window rooted at `cwd` (Tauri only): Windows
 * Terminal (or PowerShell) on Windows, the default terminal on Unix.
 */
export async function openExternalTerminal(cwd: string): Promise<'opened'> {
  if (!isTauriRuntime()) throw fsError('unsupported')
  const status = await invoke<string>('open_external_terminal', { path: cwd })
  if (status !== 'opened') throw fsError('failed')
  return 'opened'
}

export function onTerminalOutput(
  cb: (out: PtyOutput) => void,
): Promise<UnlistenFn> {
  // Outside the desktop runtime there is no backend emitting events:
  // resolve a noop unlisten instead of rejecting (avoids unhandled
  // rejections on every mount in the browser).
  if (!isTauriRuntime()) return Promise.resolve(() => undefined)
  return listen<PtyOutput>('terminal-output', (event) => cb(event.payload))
}

export function onTerminalExit(cb: (exit: PtyExit) => void): Promise<UnlistenFn> {
  if (!isTauriRuntime()) return Promise.resolve(() => undefined)
  return listen<PtyExit>('terminal-exit', (event) => cb(event.payload))
}
