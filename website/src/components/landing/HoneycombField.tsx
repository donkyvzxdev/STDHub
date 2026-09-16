import { useEffect, useRef } from 'react'
import './honeycomb-field.css'

const COL_W = 42
const ROW_H = 48.5
const COL_OFF = 24.25
const COLS = 40
const ROW_MIN = -1
const ROW_MAX = 10
const SMOOTH = 0.5
const SNAP = 0.5

interface Cell {
  x: number
  y: number
  q: number
  r: number
}

// Flat-top hex grid, 56x48.5 cells (odd-q axial coords for exact distance),
// aligned with the 84x48.5 SVG outline tile below.
const CELLS: Cell[] = []
for (let c = 0; c < COLS; c++) {
  for (let r = ROW_MIN; r <= ROW_MAX; r++) {
    CELLS.push({
      x: c * COL_W,
      y: r * ROW_H + (c % 2 === 1 ? COL_OFF : 0),
      q: c,
      r: r - ((c - (c & 1)) >> 1),
    })
  }
}
const ROWS = ROW_MAX - ROW_MIN + 1

function hexDistance(a: Cell, b: Cell): number {
  return (
    (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) /
    2
  )
}

/** Nearest hex center — exact on edges, unlike per-axis rounding. */
function pickNearest(x: number, y: number): number {
  const c0 = x / COL_W
  const r0 = y / ROW_H
  let best = 0
  let bestD = Number.POSITIVE_INFINITY
  for (let c = Math.floor(c0) - 1; c <= Math.ceil(c0) + 1; c++) {
    if (c < 0 || c >= COLS) continue
    for (let r = Math.floor(r0) - 2; r <= Math.ceil(r0) + 2; r++) {
      if (r < ROW_MIN || r > ROW_MAX) continue
      const i = c * ROWS + (r - ROW_MIN)
      const dx = CELLS[i].x + 28 - x
      const dy = CELLS[i].y + 24.25 - y
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
  }
  return best
}

/**
 * Honeycomb background over the headline region: a seamless SVG tile draws
 * the hexagon outlines; solid DOM hexagons fill the pointed cell plus its
 * first ring (100%) while the cursor is near. The cursor position is smoothed
 * (lerped every frame) and cells resolve to the nearest hex center, so the
 * highlight tracks the pointer exactly. One plain opacity transition in CSS
 * does the smoothing; JS only flips the target. Purely decorative.
 */
function HoneycombField() {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const fillsRef = useRef<(HTMLDivElement | null)[]>([])
  const litRef = useRef<Set<number>>(new Set())
  const targetRef = useRef<{ x: number; y: number } | null>(null)
  const smoothRef = useRef<{ x: number; y: number } | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const box = boxRef.current
    const section = box?.parentElement
    if (!box || !section) return

    function paint(center: number): void {
      const next = new Set<number>()
      if (center >= 0) {
        const base = CELLS[center]
        for (let i = 0; i < CELLS.length; i++) {
          if (hexDistance(CELLS[i], base) <= 1) next.add(i)
        }
      }
      for (const i of litRef.current) {
        if (!next.has(i)) {
          const el = fillsRef.current[i]
          if (el) el.style.opacity = '0'
        }
      }
      for (const i of next) {
        if (!litRef.current.has(i)) {
          const el = fillsRef.current[i]
          if (el) el.style.opacity = '1'
        }
      }
      litRef.current = next
    }

    function frame(): void {
      rafRef.current = 0
      const el = boxRef.current
      const target = targetRef.current
      if (!el || !target) return
      const rect = el.getBoundingClientRect()
      const tx = target.x - rect.left
      const ty = target.y - rect.top
      const smooth = smoothRef.current
      let sx = tx
      let sy = ty
      if (smooth) {
        sx = smooth.x + (tx - smooth.x) * SMOOTH
        sy = smooth.y + (ty - smooth.y) * SMOOTH
        if (Math.abs(tx - sx) < SNAP && Math.abs(ty - sy) < SNAP) {
          sx = tx
          sy = ty
        }
      }
      const settled = sx === tx && sy === ty
      smoothRef.current = { x: sx, y: sy }
      el.style.setProperty('--gx', `${sx.toFixed(1)}px`)
      el.style.setProperty('--gy', `${sy.toFixed(1)}px`)
      paint(pickNearest(sx, sy))
      rafRef.current = settled ? 0 : requestAnimationFrame(frame)
    }

    function kick(): void {
      if (rafRef.current === 0) rafRef.current = requestAnimationFrame(frame)
    }

    function onMove(e: MouseEvent): void {
      targetRef.current = { x: e.clientX, y: e.clientY }
      kick()
    }

    function onLeave(): void {
      targetRef.current = null
      smoothRef.current = null
      if (rafRef.current !== 0) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      paint(-1)
    }

    section.addEventListener('mousemove', onMove)
    section.addEventListener('mouseleave', onLeave)
    return () => {
      if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current)
      section.removeEventListener('mousemove', onMove)
      section.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <div
      ref={boxRef}
      aria-hidden
      className="absolute inset-x-0 top-0 h-[450px] overflow-hidden text-primary [mask-image:linear-gradient(to_bottom,black_65%,transparent)]"
    >
      <div
        aria-hidden
        className="absolute top-0 left-0 size-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,currentColor_0%,transparent_70%)] opacity-0 blur-2xl transition-opacity duration-500 group-hover/hero:opacity-[0.14]"
        style={{
          transform:
            'translate3d(var(--gx, -500px), var(--gy, -500px), 0)',
        }}
      />
      <svg
        className="absolute inset-y-0 left-0"
        width="200%"
        height="100%"
        focusable="false"
      >
        <defs>
          <pattern
            id="hf-honey"
            width="84"
            height="48.5"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M56 24.25 L42 48.5 L14 48.5 L0 24.25 L14 0 L42 0 Z"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.18"
              strokeWidth="1.5"
            />
            <path
              d="M98 0 L84 24.25 L56 24.25 L42 0 L56 -24.25 L84 -24.25 Z"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.18"
              strokeWidth="1.5"
            />
            <path
              d="M98 48.5 L84 72.75 L56 72.75 L42 48.5 L56 24.25 L84 24.25 Z"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.18"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hf-honey)" />
      </svg>
      {CELLS.map((cell, i) => (
        <div
          key={i}
          className="hf-spot"
          style={{ left: cell.x, top: cell.y }}
        >
          <div
            ref={(el) => {
              fillsRef.current[i] = el
            }}
            className="hf-fill"
          />
        </div>
      ))}
    </div>
  )
}

export default HoneycombField
