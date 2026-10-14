/**
 * CHADVILLE ESTATES — the rules: four plots, a 2 m build grid on each, a catalogue of pieces, and validation.
 * Kept free of three.js so the save sanitiser, the editor UI and the world view all share one source of truth.
 *
 * A plot is COLS × ROWS cells. A piece sits at cell (x, z) with rotation r (quarter turns); its footprint is w × d
 * cells (swapped when r is odd). Placing checks: inside the plot, no overlap, the plot isn't full, you can afford it.
 * Pieces cost Chad Coins and are fully refunded when removed, so experimenting is free.
 */
export const CELL = 2
export const COLS = 6
export const ROWS = 5
export const MAX_PIECES = 30
export const PLOT_PRICE = 120

/** world rects (x0..x1, z0..z1) + which side faces the lane (the gate + sign) */
export type Plot = { id: string; name: string; x0: number; z0: number; gate: 'w' | 'e' }
export const PLOTS: Plot[] = [
  { id: 'A', name: 'Plot A', x0: -44, z0: 51, gate: 'w' },
  { id: 'B', name: 'Plot B', x0: -62, z0: 51, gate: 'e' },
  { id: 'C', name: 'Plot C', x0: -44, z0: 65, gate: 'w' },
  { id: 'D', name: 'Plot D', x0: -62, z0: 65, gate: 'e' },
]
export const PLOT = (id: string) => PLOTS.find((p) => p.id === id)
export const plotSize = { w: COLS * CELL, d: ROWS * CELL }
/** where the plot's gate + sign stand (on the lane side, mid-depth) */
export const plotGate = (p: Plot) => ({ x: p.gate === 'w' ? p.x0 - 0.9 : p.x0 + plotSize.w + 0.9, z: p.z0 + plotSize.d / 2 })

export type PieceKind = 'cottage' | 'tower' | 'hedge' | 'fence' | 'lamp' | 'bench' | 'tree' | 'flowers' | 'pumpkins' | 'fountain' | 'path'
export type PieceDef = { kind: PieceKind; name: string; w: number; d: number; price: number; solid: boolean; color: string }
export const PIECES: PieceDef[] = [
  { kind: 'cottage', name: 'Cottage', w: 2, d: 2, price: 60, solid: true, color: '#c8a070' },
  { kind: 'tower', name: 'Tower', w: 1, d: 1, price: 20, solid: true, color: '#8a8478' },
  { kind: 'fountain', name: 'Fountain', w: 1, d: 1, price: 25, solid: true, color: '#7fc8e8' },
  { kind: 'tree', name: 'Tree', w: 1, d: 1, price: 10, solid: true, color: '#4a7a46' },
  { kind: 'lamp', name: 'Lamp', w: 1, d: 1, price: 8, solid: true, color: '#ffd25a' },
  { kind: 'bench', name: 'Bench', w: 1, d: 1, price: 6, solid: true, color: '#9a6b44' },
  { kind: 'hedge', name: 'Hedge', w: 1, d: 1, price: 4, solid: true, color: '#35553a' },
  { kind: 'fence', name: 'Fence', w: 1, d: 1, price: 3, solid: true, color: '#6a4a30' },
  { kind: 'flowers', name: 'Flowers', w: 1, d: 1, price: 4, solid: false, color: '#ff8ad8' },
  { kind: 'pumpkins', name: 'Pumpkins', w: 1, d: 1, price: 3, solid: false, color: '#e8641a' },
  { kind: 'path', name: 'Path', w: 1, d: 1, price: 1, solid: false, color: '#b8b0a0' },
]
export const PIECE = (k: string) => PIECES.find((p) => p.kind === k)

export type Piece = { k: PieceKind; x: number; z: number; r: number }
export type Estate = { plot: string | null; pieces: Piece[] }
export const emptyEstate = (): Estate => ({ plot: null, pieces: [] })

/** a piece's footprint in cells (rotation swaps width and depth) */
export function footprint(p: Piece) {
  const d = PIECE(p.k)!
  const odd = p.r % 2 === 1
  return { x0: p.x, z0: p.z, w: odd ? d.d : d.w, h: odd ? d.w : d.d }
}
const cells = (p: Piece) => {
  const f = footprint(p)
  const out: string[] = []
  for (let i = 0; i < f.w; i++) for (let j = 0; j < f.h; j++) out.push(`${f.x0 + i},${f.z0 + j}`)
  return out
}

export type PlaceError = 'outside' | 'blocked' | 'full' | 'coins'
/** can `p` go here, given the other pieces (pass `ignore` to test a move of an existing piece) */
export function canPlace(pieces: Piece[], p: Piece, ignore?: Piece): PlaceError | null {
  const f = footprint(p)
  if (f.x0 < 0 || f.z0 < 0 || f.x0 + f.w > COLS || f.z0 + f.h > ROWS) return 'outside'
  const mine = new Set(cells(p))
  for (const q of pieces) if (q !== ignore && cells(q).some((c) => mine.has(c))) return 'blocked'
  if (!ignore && pieces.length >= MAX_PIECES) return 'full'
  return null
}
export const PLACE_MSG: Record<PlaceError, string> = {
  outside: 'That doesn’t fit inside your plot.',
  blocked: 'Something’s already there.',
  full: `Your plot is full (${MAX_PIECES} pieces).`,
  coins: 'Not enough Chad Coins for that.',
}

/** the centre of a piece in world coords + its rotation in radians */
export function pieceWorld(plot: Plot, p: Piece) {
  const f = footprint(p)
  return { x: plot.x0 + (f.x0 + f.w / 2) * CELL, z: plot.z0 + (f.z0 + f.h / 2) * CELL, ry: (-p.r * Math.PI) / 2, w: f.w * CELL, d: f.h * CELL }
}

/** the front door of the first cottage on the plot (world x/z, facing in radians, half-depth to the door face) */
export function cottageDoor(e: Estate) {
  const plot = PLOT(e.plot ?? '')
  const c = e.pieces.find((p) => p.k === 'cottage')
  if (!plot || !c) return null
  const w = pieceWorld(plot, c)
  return { x: w.x, z: w.z, face: w.ry, half: 1.75 }
}

/** a stored estate, cleaned: unknown plot → none; pieces must be known kinds, in bounds and not overlapping */
export function sanitizeEstate(v: unknown): Estate {
  const o = (v ?? {}) as Record<string, unknown>
  const plot = typeof o.plot === 'string' && PLOT(o.plot) ? o.plot : null
  const out: Piece[] = []
  if (plot && Array.isArray(o.pieces)) {
    for (const raw of o.pieces.slice(0, MAX_PIECES)) {
      const q = (raw ?? {}) as Record<string, unknown>
      if (typeof q.k !== 'string' || !PIECE(q.k)) continue
      const p: Piece = { k: q.k as PieceKind, x: Math.floor(Number(q.x)), z: Math.floor(Number(q.z)), r: ((Math.floor(Number(q.r)) % 4) + 4) % 4 }
      if (!Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isFinite(p.r)) continue
      if (canPlace(out, p) === null) out.push(p)
    }
  }
  return { plot, pieces: out }
}
