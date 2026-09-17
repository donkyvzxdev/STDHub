/**
 * Native share when the OS offers it, clipboard otherwise.
 * Never builds a custom share flow while the OS has one (§63).
 */
export async function shareText(text: string, title = 'STDHub'): Promise<'shared' | 'copied' | 'failed'> {
  const nav = globalThis.navigator as Navigator & {
    share?: (data: { title?: string; text: string }) => Promise<void>
    clipboard?: { writeText: (text: string) => Promise<void> }
  }
  try {
    if (typeof nav.share === 'function') {
      await nav.share({ title, text })
      return 'shared'
    }
  } catch {
    // User dismissed the sheet — not an error.
    return 'failed'
  }
  try {
    if (nav.clipboard) {
      await nav.clipboard.writeText(text)
      return 'copied'
    }
  } catch {
    // ignore
  }
  return 'failed'
}

export async function copyText(text: string): Promise<boolean> {
  try {
    const nav = globalThis.navigator as Navigator & {
      clipboard?: { writeText: (text: string) => Promise<void> }
    }
    if (!nav.clipboard) return false
    await nav.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
