import { useRef, useState } from 'react'

/**
 * Tiny undo/redo stack for the note editor. Snapshots are pushed by the
 * caller on discrete edits (toolbar taps, debounced typing), not per key.
 */
export class UndoStack {
  private past: string[] = []
  private future: string[] = []
  private current: string

  constructor(initial = '') {
    this.current = initial
  }

  get value(): string {
    return this.current
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  push(value: string): void {
    if (value === this.current) return
    this.past.push(this.current)
    if (this.past.length > 100) this.past.shift()
    this.current = value
    this.future = []
  }

  reset(value: string): void {
    this.past = []
    this.future = []
    this.current = value
  }

  undo(): string {
    const prev = this.past.pop()
    if (prev === undefined) return this.current
    this.future.push(this.current)
    this.current = prev
    return this.current
  }

  redo(): string {
    const next = this.future.pop()
    if (next === undefined) return this.current
    this.past.push(this.current)
    this.current = next
    return this.current
  }
}

export function useUndo(initial: string) {
  const [stack] = useState(() => new UndoStack(initial))
  const [, bump] = useState(0)
  const refresh = (): void => bump((n) => n + 1)
  const controls = useRef({
    push: (value: string): void => {
      stack.push(value)
      refresh()
    },
    reset: (value: string): void => {
      stack.reset(value)
      refresh()
    },
    undo: (): string => {
      const value = stack.undo()
      refresh()
      return value
    },
    redo: (): string => {
      const value = stack.redo()
      refresh()
      return value
    },
  })
  return {
    value: stack.value,
    canUndo: stack.canUndo,
    canRedo: stack.canRedo,
    ...controls.current,
  }
}
