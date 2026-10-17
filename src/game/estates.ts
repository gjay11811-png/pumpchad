/**
 * CHADVILLE ESTATES — the rules: 52 plots, a 2 m build grid on each, a catalogue of pieces, and validation.
 * Kept free of three.js so the save sanitiser, the editor UI and the world view all share one source of truth.
 *
 * A plot is COLS × ROWS cells. A piece sits at cell (x, z) with rotation r (quarter turns); its footprint is w × d
 * cells (swapped when r is odd). Placing checks: inside the plot, no overlap, the plot isn't full, you can afford it.
 * Pieces cost Chad Coins and are fully refunded when removed, so experimenting is free.
 *
 * PLOT SIZE (changed 17 Oct 2026): 11 × 13 cells = 22 × 26 m (was 6 × 5 cells = 12 × 10 m). Chosen by FITTING an example large house: a 6 × 5-cell manor
 * (12 × 10 m, two floors) with a 3 × 3-cell double garage beside it (10 cells wide with a one-cell side yard), a four-row front garden with a paved
 * driveway from the street to the garage, and four rows of garden behind it = 11 × 13. See `exampleMansion()` and scripts/estate-rules-test.mjs.
 * Old saves are migrated (see `migrateEstate`): the layout is turned so its frontage meets the street and pushed to the street edge, so a furnished plot
 * keeps the same relationship to its gate. Height limit: every piece is at most 9 m tall (the manor is 2 floors); the rest is per-piece.
 */
export const CELL = 2
export const COLS = 11
export const ROWS = 13
export const OLD_COLS = 6
export const OLD_ROWS = 5
export const MAX_PIECES = 80
export const MAX_HEIGHT = 9
export const PLOT_PRICE = 120
/** version of the estate layout stored in saves: 1 = the original 6 × 5 plots, 2 = the large 11 × 13 plots */
export const ESTATE_VERSION = 2

/** world rects (x0..x1, z0..z1) + which side faces the lane (the gate + sign) */
export type Gate = 'w' | 'e' | 'n' | 's'
export type Plot = { id: string; name: string; x0: number; z0: number; gate: Gate; row?: string }
/**
 * CHADVILLE HEIGHTS (large-plot layout): four rows of 13 plots either side of two lanes, west of the spine road, 52 plots in all — the four original plots A–D
 * (east end of the south row) and H01…H48 in row-major order from the east. A plot's id never changes if the art does. Layout (z, north → south):
 *     row 1 (gate s)  −42 … −16   |  lane A −16 … −10  |  row 2 (gate n) −10 … 16   |  row 3 (gate s)  16 … 42  |  lane B 42 … 48  |  row 4 (gate n)  48 … 74
 * Plots are 22 m wide on a 23 m pitch (a 1 m hedge gap), 13 slots, the first one 1 m west of the spine road. The old district (x −242 … −64) is now the
 * HEIGHTS GREEN: a long boulevard from the estates arch to the spine, lawns, the three show homes and a bike-friendly straight.
 */
export const HEIGHTS = {
  /** the housing district's walkable rectangle (also in city.ts as DISTRICTS.heightsWest); it overlaps the Green by 2 m so the seam has no wall */
  rect: { x0: -552, x1: -240, z0: -44, z1: 78 },
  spine: { x0: -250, x1: -246, z0: -42, z1: 76 },
  laneA: { x0: -550, x1: -250, z0: -16, z1: -10 },
  laneB: { x0: -550, x1: -250, z0: 42, z1: 48 },
  /** the Green's boulevard: from the estates arch's lane west to the spine */
  boulevard: { x0: -250, x1: -64, z0: 45, z1: 49 },
  /** the Green (the old district) */
  green: { x0: -242, x1: -64, z0: 26, z1: 78 },
  slots: 13,
  pitch: 23,
  firstX1: -251,
  plotW: COLS * CELL,
  plotD: ROWS * CELL,
}
const plotX0 = (slot: number) => HEIGHTS.firstX1 - HEIGHTS.pitch * slot - COLS * CELL
const ROWS_DEF: { z0: number; gate: Gate; row: string }[] = [
  { z0: -42, gate: 's', row: 'North row' },
  { z0: -10, gate: 'n', row: 'Lane A south' },
  { z0: 16, gate: 's', row: 'Lane B north' },
  { z0: 48, gate: 'n', row: 'South row' },
]
const makePlots = (): Plot[] => {
  const out: Plot[] = []
  let n = 1
  ROWS_DEF.forEach((r, ri) => {
    for (let i = 0; i < HEIGHTS.slots; i++) {
      // the original four plots A–D keep their ids: the east end of the south row (nearest the village)
      if (ri === 3 && i < 4) out.push({ id: 'ABCD'[i], name: `Plot ${'ABCD'[i]}`, x0: plotX0(i), z0: r.z0, gate: r.gate, row: r.row })
      else out.push({ id: `H${String(n).padStart(2, '0')}`, name: `Heights ${String(n++).padStart(2, '0')}`, x0: plotX0(i), z0: r.z0, gate: r.gate, row: r.row })
    }
  })
  return out
}
export const PLOTS: Plot[] = makePlots()
/** the ORIGINAL plots' old frames (6 × 5 cells) and which side their gate faced: saves from before the large-plot layout are migrated from these */
export const OLD_GATES: Record<string, Gate> = { A: 'w', B: 'e', C: 'w', D: 'e' }
const oldGate = (id: string): Gate => OLD_GATES[id] ?? (Number(id.slice(1)) <= 9 || (Number(id.slice(1)) >= 23 && Number(id.slice(1)) <= 35) ? 's' : 'n')
/** street trees along the two lanes and the spine: in the 1 m gaps between plots, every other gap, alternating sides (they stand on the lane's edge strip, leaving 4 m to walk) */
export const HEIGHTS_TREES: [number, number][] = (() => {
  const out: [number, number][] = []
  for (let i = 0; i < HEIGHTS.slots; i++) {
    const gx = plotX0(i) - 0.5
    if (i % 2) continue
    out.push([gx, -15.5], [gx - 23, -10.5], [gx, 42.5], [gx - 23, 47.5])
  }
  // the boulevard: a tree every 24 m, alternating sides
  for (let x = -76, k = 0; x > -244; x -= 24, k++) out.push([x, k % 2 ? 44.2 : 49.8])
  return out.filter(([x]) => x > -548)
})()
export type ShowHome = { id: 'cottage' | 'contemporary' | 'premium'; name: string; blurb: string; x: number; z: number; face: 's' }
/** the three show homes: look-and-walk-round models on the Green (north of the boulevard), not for sale and not buildable; each lot is SHOW_LOT (12 × 10 m) */
export const SHOW_LOT = { w: 12, d: 10 }
export const SHOW_HOMES: ShowHome[] = [
  { id: 'cottage', name: 'The Cottage', blurb: 'A timber-framed starter home', x: -214, z: 38, face: 's' },
  { id: 'contemporary', name: 'The Contemporary', blurb: 'Flat roof, glass and a cantilever', x: -198, z: 38, face: 's' },
  { id: 'premium', name: 'The Premium', blurb: 'Two storeys, columns and a balcony', x: -182, z: 38, face: 's' },
]
export const PLOT = (id: string) => PLOTS.find((p) => p.id === id)
export const plotSize = { w: COLS * CELL, d: ROWS * CELL }
/** where the plot's gate + sign stand (on the lane side, mid-width) */
export const plotGate = (p: Plot) => {
  const { w, d } = plotSize
  if (p.gate === 'n') return { x: p.x0 + w / 2, z: p.z0 - 0.9 }
  if (p.gate === 's') return { x: p.x0 + w / 2, z: p.z0 + d + 0.9 }
  return { x: p.gate === 'w' ? p.x0 - 0.9 : p.x0 + w + 0.9, z: p.z0 + d / 2 }
}

export type PieceKind = 'cottage' | 'manor' | 'garage' | 'tower' | 'hedge' | 'fence' | 'gates' | 'lamp' | 'bench' | 'tree' | 'flowers' | 'pumpkins' | 'fountain' | 'path' | 'drive' | 'terrace'
export type PieceDef = { kind: PieceKind; name: string; w: number; d: number; price: number; solid: boolean; color: string }
export const PIECES: PieceDef[] = [
  { kind: 'cottage', name: 'Cottage', w: 2, d: 2, price: 60, solid: true, color: '#c8a070' },
  { kind: 'manor', name: 'Manor house', w: 6, d: 5, price: 240, solid: true, color: '#d6c2a0' },
  { kind: 'garage', name: 'Double garage', w: 3, d: 3, price: 90, solid: true, color: '#a89c8a' },
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
  { kind: 'drive', name: 'Driveway', w: 1, d: 1, price: 2, solid: false, color: '#6a6a70' },
  { kind: 'terrace', name: 'Terrace', w: 2, d: 2, price: 12, solid: false, color: '#c8bfae' },
  { kind: 'gates', name: 'Iron gates', w: 2, d: 1, price: 30, solid: false, color: '#2a2a30' },
]
export const PIECE = (k: string) => PIECES.find((p) => p.kind === k)

export type Piece = { k: PieceKind; x: number; z: number; r: number }
export type Estate = { plot: string | null; pieces: Piece[]; /** layout version (see ESTATE_VERSION); absent = the original 6 × 5 plots */ v?: number }
export const emptyEstate = (): Estate => ({ plot: null, pieces: [], v: ESTATE_VERSION })

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

/** the front door of the first house (a manor, else a cottage) on the plot: world x/z, facing in radians, half-depth to the door face */
export function cottageDoor(e: Estate) {
  const plot = PLOT(e.plot ?? '')
  const c = e.pieces.find((p) => p.k === 'manor') ?? e.pieces.find((p) => p.k === 'cottage')
  if (!plot || !c) return null
  const w = pieceWorld(plot, c)
  return { x: w.x, z: w.z, face: w.ry, half: c.k === 'manor' ? 4.75 : 1.75 }
}

const DIR: Gate[] = ['n', 'e', 's', 'w'] // clockwise seen from above: turning a layout clockwise sends n → e → s → w
/**
 * Bring an estate saved with the ORIGINAL 6 × 5 plot into the large 11 × 13 plot. The old layout is turned (whole quarter turns, clockwise) so its frontage faces the
 * plot's gate side, then pushed against the frontage edge and centred along it — a furnished plot keeps the same relationship to its street and its door.
 */
export function migrateEstate(plotId: string, pieces: Piece[]): Piece[] {
  const plot = PLOT(plotId)
  if (!plot) return []
  const k = (DIR.indexOf(plot.gate) - DIR.indexOf(oldGate(plotId)) + 4) % 4
  // rotate a cell rectangle about the origin, clockwise, k times: (x, z) → (−z, x)
  const rot = (r: { x: number; z: number; w: number; h: number }) => {
    let { x, z, w, h } = r
    for (let i = 0; i < k; i++) {
      const nx = -(z + h)
      const nz = x
      ;[x, z, w, h] = [nx, nz, h, w]
    }
    return { x, z, w, h }
  }
  const plotRect = rot({ x: 0, z: 0, w: OLD_COLS, h: OLD_ROWS })
  const dims = { w: plotRect.w, h: plotRect.h }
  // where the rotated old plot sits in the new one: against the gate edge, centred along it
  let ox = Math.floor((COLS - dims.w) / 2)
  let oz = Math.floor((ROWS - dims.h) / 2)
  if (plot.gate === 'n') oz = 0
  else if (plot.gate === 's') oz = ROWS - dims.h
  else if (plot.gate === 'w') ox = 0
  else ox = COLS - dims.w
  return pieces.map((p) => {
    const d = PIECE(p.k)
    if (!d) return p
    const odd = p.r % 2 === 1
    const f = rot({ x: p.x, z: p.z, w: odd ? d.d : d.w, h: odd ? d.w : d.d })
    return { k: p.k, x: f.x - plotRect.x + ox, z: f.z - plotRect.z + oz, r: (p.r + k) % 4 }
  })
}

/** a stored estate, cleaned: unknown plot → none; pieces must be known kinds, in bounds and not overlapping; old (v1) layouts are migrated to the large plot */
export function sanitizeEstate(v: unknown): Estate {
  const o = (v ?? {}) as Record<string, unknown>
  const plot = typeof o.plot === 'string' && PLOT(o.plot) ? o.plot : null
  const out: Piece[] = []
  if (plot && Array.isArray(o.pieces)) {
    const raw: Piece[] = []
    for (const r of o.pieces.slice(0, MAX_PIECES)) {
      const q = (r ?? {}) as Record<string, unknown>
      if (typeof q.k !== 'string' || !PIECE(q.k)) continue
      const p: Piece = { k: q.k as PieceKind, x: Math.floor(Number(q.x)), z: Math.floor(Number(q.z)), r: ((Math.floor(Number(q.r)) % 4) + 4) % 4 }
      if (Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.r)) raw.push(p)
    }
    const list = o.v === ESTATE_VERSION ? raw : migrateEstate(plot, raw)
    for (const p of list) if (canPlace(out, p) === null) out.push(p)
  }
  return { plot, pieces: out, v: ESTATE_VERSION }
}

/** the example large house the plot size was chosen to fit: manor + double garage + paved drive + front garden + rear garden (used by the rules test and the show of what is possible) */
export function exampleMansion(): Piece[] {
  const P: Piece[] = [
    { k: 'manor', x: 1, z: 5, r: 0 }, // 6 × 5 cells at columns 1–6, rows 5–9; its door faces +z (south) — the plot's gate must then be south (rows 1 / 3)
    { k: 'garage', x: 7, z: 5, r: 0 },
    { k: 'gates', x: 3, z: 12, r: 0 },
  ]
  for (let z = 9; z <= 12; z++) P.push({ k: 'drive', x: 8, z, r: 0 }) // driveway from the garage door to the street
  for (let x = 3; x <= 4; x++) for (let z = 10; z <= 11; z++) P.push({ k: 'path', x, z, r: 0 }) // front path
  for (const x of [1, 6]) P.push({ k: 'hedge', x, z: 11, r: 0 })
  P.push({ k: 'tree', x: 0, z: 10, r: 0 }, { k: 'tree', x: 10, z: 2, r: 0 }, { k: 'fountain', x: 3, z: 2, r: 0 }, { k: 'terrace', x: 1, z: 3, r: 0 })
  return P
}
