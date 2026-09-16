/** Insertion index for clientX given ordered tab center positions. */
export function insertionIndex(clientX: number, centers: number[]): number {
  for (let i = 0; i < centers.length; i++) {
    if (clientX < centers[i]) return i
  }
  return centers.length
}

/** Distance in pixels before a press becomes a drag. */
export const DRAG_THRESHOLD = 6

/** Null-safe elementFromPoint (jsdom and odd embeds may lack it). */
export function safeElementFromPoint(x: number, y: number): Element | null {
  try {
    if (typeof document.elementFromPoint !== 'function') return null
    return document.elementFromPoint(x, y)
  } catch {
    return null
  }
}
